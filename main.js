const electron = require("electron"); // eslint-disable-line

// Module to control application life.
const { app, BrowserWindow, ipcMain } = electron;

// Developer Dependencies.
const isDev = !app.isPackaged;
if (isDev) {
  require("electron-debug")(); // eslint-disable-line
}

// Additional Tooling.
const path = require('path');
const url = require('url');

// Import the functions that we can use in the render processes.
const ipcFunctions = require('./src/sf_calls');

// Get rid of the deprecated default.
app.allowRendererProcessReuse = true;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let consoleWindow;

// Create the main application window.
function createWindow() {
  const display = electron.screen.getPrimaryDisplay();
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: display.workArea.width,
    height: display.workArea.height,
    frame: true,
    webPreferences: {
      devTools: isDev,
      nodeIntegration: false, // Disable nodeIntegration for security.
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
      worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
      enableRemoteModule: false, // Turn off remote to avoid temptation.
      preload: path.join(app.getAppPath(), 'app/preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: path.join(app.getAppPath(), 'app/index.html'),
      protocol: 'file:',
      slashes: true,
    }),
  );

  // Attach to IPC handlers
  ipcFunctions.setwindow('main', mainWindow);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// Create the logging console window.
// @TODO: Generalize this and merge with previous function.
function createLoggingConsole() {
  const display = electron.screen.getPrimaryDisplay();
  // Create the browser window.
  consoleWindow = new BrowserWindow({
    width: Math.min(1200, display.workArea.width),
    height: display.workArea.height / 2,
    frame: true,
    webPreferences: {
      nodeIntegration: false, // Disable nodeIntegration for security.
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
      worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
      enableRemoteModule: false, // Turn off remote to avoid temptation.
      preload: path.join(app.getAppPath(), 'app/consolePreload.js'),
    },
  });
  consoleWindow.loadURL(
    url.format({
      pathname: path.join(app.getAppPath(), 'app/console.html'),
      protocol: 'file:',
      slashes: true,
    }),
  );

  // Attach to IPC handlers
  ipcFunctions.setwindow('console', mainWindow);

  // Emitted when the window is closed.
  consoleWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    consoleWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);
app.on('ready', createLoggingConsole);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Extra security filters.
// See also: https://github.com/reZach/secure-electron-template
app.on('web-contents-created', (event, contents) => {
  // Block navigation.
  // https://electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
  contents.on('will-navigate', (navevent) => {
    navevent.preventDefault();
  });
  contents.on('will-redirect', (navevent) => {
    navevent.preventDefault();
  });

  // https://electronjs.org/docs/tutorial/security#11-verify-webview-options-before-creation
  contents.on('will-attach-webview', (webevent, webPreferences) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
  });

  // Block new windows from within the App
  // https://electronjs.org/docs/tutorial/security#13-disable-or-limit-creation-of-new-windows
  contents.on('new-window', async (newevent) => {
    newevent.preventDefault();
  });
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
    createLoggingConsole();
  }
});

// Add the list of handlers provided in the ElectronForce.handlers library.
const efHandlers = Object.getOwnPropertyNames(ipcFunctions.handlers);
efHandlers.forEach((value) => {
  ipcMain.on(value, ipcFunctions.handlers[value]);
});
