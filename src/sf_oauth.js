const electron = require("electron"); // eslint-disable-line
const { shell } = electron;

// Additional Tooling.
const crypto = require('crypto');
const http = require('http');
const jsforce = require('jsforce');

const CALLBACK_PATH = '/callback';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

// Default local port for the OAuth callback server. Matches ElectronForce so a
// single External Client App can serve both tools.
const DEFAULT_CALLBACK_PORT = 3835;

// Connection settings for the External Client App.
const oauthSettings = {
  callbackPort: DEFAULT_CALLBACK_PORT,
  scopes: ['api', 'id', 'refresh_token'],
};

// Supplies the client credentials when a login starts. Credentials live in
// encrypted storage, and reading them can prompt for OS keychain access, so
// they are only loaded when actually needed.
let credentialProvider = () => ({
  clientId: process.env.SALESFORCE_CLIENT_ID || '',
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
});

// The in-progress login, if any, so a new attempt can cancel a stale one.
let activeLogin = null;

/**
 * Builds the OAuth redirect URI for a given local port. This must exactly match
 * a Callback URL configured on the Salesforce External Client App.
 * @param {number} port The local callback port.
 * @returns {string} The redirect URI.
 */
const buildRedirectUri = (port) => `http://localhost:${port}${CALLBACK_PATH}`;

/**
 * Normalizes a callback port value, falling back to the default when invalid.
 * @param {*} port The requested port.
 * @returns {number} A valid TCP port number.
 */
const normalizeCallbackPort = (port) => {
  const parsed = Number.parseInt(port, 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return DEFAULT_CALLBACK_PORT;
};

/**
 * Sets the function that supplies the External Client App credentials. It is
 * called once per login attempt, never ahead of time.
 * @param {Function} provider Returns {clientId, clientSecret}.
 */
const setCredentialProvider = (provider) => {
  credentialProvider = provider;
};

/**
 * Sets the local port for the OAuth callback server.
 * @param {*} port The requested port. Invalid values fall back to the default.
 */
const setCallbackPort = (port) => {
  oauthSettings.callbackPort = normalizeCallbackPort(port);
};

/**
 * Cancels the in-progress login attempt, if there is one.
 * @param {Error} err The reason the login was cancelled.
 */
function cancelActiveLogin(err) {
  if (activeLogin) {
    activeLogin.cancel(err);
  }
}

/**
 * Starts a one-time local server that waits for Salesforce's OAuth redirect.
 * The server closes itself after the first callback, on error, or on timeout.
 * @param {number} port The local port to listen on.
 * @param {string} expectedState The state value sent with the authorization request.
 * @param {number} timeoutMs How long to wait for the browser sign-in.
 * @returns {Promise<string>} Resolves with the authorization code.
 */
function createLocalServer(port, expectedState, timeoutMs = LOGIN_TIMEOUT_MS) {
  cancelActiveLogin(new Error('Login cancelled because a new login attempt was started.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let server = null;

    const finish = (err, code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      server.close();
      activeLogin = null;
      if (err) {
        reject(err);
      } else {
        resolve(code);
      }
    };

    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);

      // Ignore anything that isn't the callback (favicon requests, etc).
      if (reqUrl.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const state = reqUrl.searchParams.get('state');
      if (!state || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid state parameter. Please return to Salesforce2Sql and try again.');
        finish(new Error('OAuth callback state mismatch. Please try logging in again.'));
        return;
      }

      const oauthError = reqUrl.searchParams.get('error');
      const code = reqUrl.searchParams.get('code');
      if (oauthError || !code) {
        const description = reqUrl.searchParams.get('error_description')
          || oauthError
          || 'No authorization code received';
        // Plain text so the error description can't inject markup.
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(`Authentication failed: ${description}`);
        finish(new Error(`OAuth login failed: ${description}`));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication successful!</h1><p>You can close this window and return to Salesforce2Sql.</p>');
      finish(null, code);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        finish(new Error(`OAuth callback port ${port} is already in use. Close the other application, or change the OAuth Callback Port in Preferences and the Callback URL on your External Client App to match.`));
        return;
      }
      finish(new Error(`OAuth callback server error: ${err.message}`));
    });

    timer = setTimeout(() => {
      finish(new Error('OAuth login timed out waiting for the browser sign-in. Please try again.'));
    }, timeoutMs);

    activeLogin = { cancel: (err) => finish(err) };
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Checks that a URL points at a Salesforce My Domain over HTTPS.
 * @param {string} url The URL to check.
 * @returns {boolean} True when the URL is a valid Salesforce login URL.
 */
function isValidSalesforceUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Check for HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // External Client Apps require the org's My Domain. The generic login and
    // test domains can't be used with OAuth.
    return parsedUrl.hostname.endsWith('.my.salesforce.com');
  } catch (err) {
    return false;
  }
}

/**
 * Runs the OAuth web server flow (with PKCE) in the user's default browser.
 * @param {string} authDomain The org's My Domain login URL.
 * @returns {Promise<{conn: jsforce.Connection, userInfo: object, oauth2Config: object}>}
 */
async function attemptLogin(authDomain) {
  const { callbackPort, scopes } = oauthSettings;
  const { clientId, clientSecret } = credentialProvider() || {};

  if (!clientId || !clientSecret) {
    throw new Error('Missing OAuth credentials. Both Client ID and Client Secret are required.');
  }

  // The redirect URI must be final before the authorization URL is built, and
  // must match the token exchange exactly.
  const redirectUri = buildRedirectUri(callbackPort);

  // useVerifier enables PKCE: jsforce generates a code_verifier, includes the
  // code_challenge in the auth URL, and sends the verifier at token exchange.
  const jsfOauth = new jsforce.OAuth2({
    loginUrl: authDomain,
    clientId,
    clientSecret,
    redirectUri,
    useVerifier: true,
  });

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = jsfOauth.getAuthorizationUrl({
    scope: scopes.join(' '),
    state,
  });

  if (!isValidSalesforceUrl(authUrl)) {
    throw new Error('Invalid Salesforce authentication URL. OAuth requires your My Domain URL, for example https://yourcompany.my.salesforce.com.');
  }

  const codePromise = createLocalServer(callbackPort, state);

  // authUrl was checked by isValidSalesforceUrl() above, so only HTTPS
  // Salesforce login URLs are ever opened in the browser.
  try {
    await shell.openExternal(authUrl);
  } catch (err) {
    cancelActiveLogin(err);
  }

  // Wait for the authorization code
  const code = await codePromise;

  // Exchange code for access token
  const conn = new jsforce.Connection({ oauth2: jsfOauth });
  const userInfo = await conn.authorize(code);

  // The username is only for display, so a failed identity call isn't fatal.
  let username = '';
  try {
    const identity = await conn.identity();
    username = identity.username || '';
  } catch (err) {
    username = '';
  }

  return {
    conn,
    userInfo: {
      ...userInfo,
      username,
    },
    oauth2Config: {
      loginUrl: authDomain,
      clientId,
      clientSecret,
      redirectUri,
    },
  };
}

exports.attemptLogin = attemptLogin;
exports.buildRedirectUri = buildRedirectUri;
exports.normalizeCallbackPort = normalizeCallbackPort;
exports.setCredentialProvider = setCredentialProvider;
exports.setCallbackPort = setCallbackPort;
exports.DEFAULT_CALLBACK_PORT = DEFAULT_CALLBACK_PORT;
