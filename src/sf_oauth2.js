const electron = require("electron"); // eslint-disable-line

// Extract the needed elements.
const {
  BrowserWindow,
  session,
} = electron;

// Additional Tooling.
const jsforce = require('jsforce');
const http = require('http');

const { shell } = electron;

function createAuthWindow() {
  // Lock down the session.
  const authSession = session.fromPartition('auth-partition');
  authSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  // Set default security policies for the session
  authSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "script-src 'self' https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "style-src 'self' 'unsafe-inline' https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "img-src 'self' data: https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "font-src 'self' data: https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "connect-src 'self' https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
          "frame-src 'self' https://*.salesforce.com https://*.force.com https://login.salesforce.com;",
        ].join(' '),
      },
    });
  });

  // Create the browser window with secure defaults
  let authWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: true,
    frame: true,
    show: false,
    session: authSession,
    webPreferences: {
      devTools: process.env.NODE_ENV === 'development',
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      disableBlinkFeatures: 'Auxclick', // See: https://github.com/doyensec/electronegativity/wiki/AUXCLICK_JS_CHECK
      contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
      worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
      enableRemoteModule: false, // Turn off remote to avoid temptation.
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      sandbox: true,
    },
  });

  // Emitted when the window is closed.
  authWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    authWindow = null;
  });

  // Add these handlers after creating the window
  authWindow.webContents.on('did-start-loading', () => {
    console.log('Window started loading');
  });

  authWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load: ${errorDescription} (${errorCode}) for URL: ${validatedURL}`);
  });

  // Open DevTools in detached mode for debugging
  if (process.env.NODE_ENV === 'development') {
    authWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return authWindow;
}

function createLocalServer(jsfOauth) {
  return new Promise((resolve, reject) => {
    // Create local server to handle OAuth callback
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/completesetup')) {
        const url = new URL(req.url, 'http://localhost');
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
      console.log(`Local server listening on port ${port}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      reject(error);
    });
  });
}

async function attemptLogin(authDomain) {
  // Create OAuth configuration
  const jsfOauth = new jsforce.OAuth2({
    loginUrl: authDomain,
    clientId: '3MVG9cHH2bfKACZaQ.djia5w9g24IaXl.LCkYPmKS.T7ud235Q8c1pX0_zN6xkDBj.88d1qLf1pTcmZwGODB.',
    redirectUri: 'http://localhost/completesetup',
  });

  try {
    // Start local server to handle callback
    const codePromise = createLocalServer(jsfOauth);

    // Get authorization URL and open in default browser
    const authUrl = jsfOauth.getAuthorizationUrl({ scope: 'api id web refresh_token' });
    console.log(`Opening browser for authentication: ${authUrl}`);
    await shell.openExternal(authUrl);

    // Wait for the authorization code
    const code = await codePromise;
    console.log('Received authorization code');

    // Exchange code for access token
    const conn = new jsforce.Connection({ oauth2: jsfOauth });
    const userInfo = await conn.authorize(code);

    console.log('Authentication successful');
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
