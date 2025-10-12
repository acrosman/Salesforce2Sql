const electron = require("electron"); // eslint-disable-line
const { shell } = electron;

// Additional Tooling.
const jsforce = require('jsforce');
const http = require('http');

const config = require('./config');

function createLocalServer(jsfOauth) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {

      // Remove any port information from the URL
      if (req.url.startsWith('/completesetup')) {
        const url = new URL(req.url, `http://localhost:${server.address().port}`);
        const code = url.searchParams.get('code');

        if (code) {
          // Send success response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');

          // Close server and resolve promise with auth code
          server.close();
          resolve(code);
        } else {
          reject(new Error('No authorization code received'));
        }
      }
    });

    // Listen on a random available port
    server.listen(0, 'localhost', () => {
      const { port } = server.address();
      // Update the OAuth config with the actual port
      jsfOauth.redirectUri = `http://localhost:${port}/completesetup`;
    });
  });
}

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
      'login.cloudforce.com',
    ];

    return validDomains.some((domain) => parsedUrl.hostname === domain
      || parsedUrl.hostname.endsWith('.my.salesforce.com')
      || parsedUrl.hostname.endsWith('.cloudforce.com'));
  } catch (err) {
    return false;
  }
}

async function attemptLogin(authDomain) {
  if (!config.oauth.clientId || !config.oauth.clientSecret) {
    throw new Error('Missing OAuth credentials. Both Client ID and Client Secret are required.');
  }

  // Create OAuth configuration
  const jsfOauth = new jsforce.OAuth2({
    loginUrl: authDomain,
    clientId: config.oauth.clientId,
    clientSecret: config.oauth.clientSecret,
    redirectUri: 'http://localhost/completesetup',
  });

  try {
    const codePromise = createLocalServer(jsfOauth);

    const authUrl = jsfOauth.getAuthorizationUrl({
      scope: config.oauth.scopes.join(' '),
    });

    if (!isValidSalesforceUrl(authUrl)) {
      throw new Error('Invalid Salesforce authentication URL');
    }

    await shell.openExternal(authUrl);

    // Wait for the authorization code
    const code = await codePromise;

    // Exchange code for access token
    const conn = new jsforce.Connection({ oauth2: jsfOauth });
    const userInfo = await conn.authorize(code);

    return {
      conn,
      userInfo,
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

exports.attemptLogin = attemptLogin;
