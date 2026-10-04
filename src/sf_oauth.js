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

// Connection settings for the External Client App. Credentials are loaded from
// encrypted storage by the preferences module.
const oauthSettings = {
  clientId: process.env.SALESFORCE_CLIENT_ID || '',
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
  callbackPort: DEFAULT_CALLBACK_PORT,
  scopes: ['api', 'id', 'refresh_token'],
};

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
 * Sets the External Client App credentials used for login.
 * @param {string} clientId The consumer key.
 * @param {string} clientSecret The consumer secret.
 */
const setCredentials = (clientId, clientSecret) => {
  oauthSettings.clientId = clientId;
  oauthSettings.clientSecret = clientSecret;
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
 * Checks that a URL points at a Salesforce login domain over HTTPS.
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

    // List of valid Salesforce login domains
    const validDomains = [
      'login.salesforce.com',
      'test.salesforce.com',
      'login.sandbox.salesforce.com',
    ];

    return validDomains.includes(parsedUrl.hostname)
      || parsedUrl.hostname.endsWith('.my.salesforce.com');
  } catch (err) {
    return false;
  }
}

/**
 * Runs the OAuth web server flow (with PKCE) in the user's default browser.
 * @param {string} authDomain The Salesforce login URL (login, test, or My Domain).
 * @returns {Promise<{conn: jsforce.Connection, userInfo: object, oauth2Config: object}>}
 */
async function attemptLogin(authDomain) {
  const {
    clientId,
    clientSecret,
    callbackPort,
    scopes,
  } = oauthSettings;

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
    throw new Error('Invalid Salesforce authentication URL');
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
exports.setCredentials = setCredentials;
exports.setCallbackPort = setCallbackPort;
exports.DEFAULT_CALLBACK_PORT = DEFAULT_CALLBACK_PORT;
