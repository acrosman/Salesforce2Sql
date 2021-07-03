const electron = require("electron"); // eslint-disable-line

// Extract the needed elements.
const {
  app,
  BrowserWindow,
  session,
} = electron;

// Additional Tooling.
const path = require('path');
const jsforce = require('jsforce');

function createAuthWindow() {
  // Lock down the session.
  const authSession = session.fromPartition('auth-partition');
  authSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  // Create the browser window.
  let authWindow = new BrowserWindow({
    width: 300,
    height: 500,
    resizable: false,
    frame: false,
    show: false,
    session: authSession,
    webPreferences: {
      devTools: true,
      nodeIntegration: false, // Disable nodeIntegration for security.
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      disableBlinkFeatures: 'Auxclick', // See: https://github.com/doyensec/electronegativity/wiki/AUXCLICK_JS_CHECK
      contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
      worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
      enableRemoteModule: false, // Turn off remote to avoid temptation.
      // preload: path.join(app.getAppPath(), 'app/authPreload.js'),
    },
  });

  // Emitted when the window is closed.
  authWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    authWindow = null;
  });

  return authWindow;
}

function attemptLogin(authDomain) {
  const jsfOauth = new jsforce.OAuth2({
    loginUrl: authDomain,
    // Temporary testing value from trailhead org.
    clientId: '3MVG9cHH2bfKACZaQ.djia5w9g24IaXl.LCkYPmKS.T7ud235Q8c1pX0_zN6xkDBj.88d1qLf1pTcmZwGODB.',
    redirectUri: 'https://localhost/completesetup',
  });

  const authWindow = createAuthWindow();

  // Prepare to filter only the callbacks for my redirectUri
  const filter = {
    urls: [`${authDomain}/*`],
  };

  // Intercept 302's triggered on page load attempt and redirect.
  authWindow.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
    const { statusCode, responseHeaders } = details;

    // This is redirect, so let's try again.
    if (statusCode === 302) {
      authWindow.loadURL(responseHeaders.Location.pop());
    }

    // don't forget to let the request proceed
    callback({
      cancel: false,
    });
  });

  // 'will-navigate' is an event emitted when the window.location changes
  // newUrl should contain the tokens you need
  authWindow.webContents.on('will-navigate', (event, newUrl) => {
    console.log(newUrl);
    // More complex code to handle tokens goes here.
  });

  authWindow.once('ready-to-show', () => {
    authWindow.show();
  });

  // Load the authUrl from Salesforce.
  const authUrl = jsfOauth.getAuthorizationUrl({ scope: 'api id web refresh_token' });
  authWindow.loadURL(authUrl).catch((err) => {
    console.log(err);
  });
}

exports.attemptLogin = attemptLogin;
