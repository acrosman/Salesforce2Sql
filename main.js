const electron = require("electron"); // eslint-disable-line

// Module to control application life.
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
} = electron;

// Developer Dependencies.
const isDev = !app.isPackaged;
if (isDev) {
  require("electron-debug")(); // eslint-disable-line
}

// run this as early in the main process as possible
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) app.quit();

// Additional Tooling.
const path = require('path');

// Import the functions that we can use in the render processes.
const ipcFunctions = require('./src/sf_calls');

// Import the menu template
const { menuTemplate } = require('./src/menu');

// Import save preferences function.
const {
  getCurrentPreferences,
  closePreferences,
  loadPreferences,
  savePreferences,
  setMainWindow,
} = require('./src/preferences');

// Import Search support.
const { executeSearch } = require('./src/find');

// Get rid of the deprecated default.
app.allowRendererProcessReuse = true;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

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
      disableBlinkFeatures: 'Auxclick', // See: https://github.com/doyensec/electronegativity/wiki/AUXCLICK_JS_CHECK
      contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
      worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
      enableRemoteModule: false, // Turn off remote to avoid temptation.
      preload: path.join(app.getAppPath(), 'app/preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app/index.html`);

  // Attach to IPC handlers
  ipcFunctions.setWindow(mainWindow);

  // Attach to preference system.
  setMainWindow(mainWindow);
  ipcFunctions.setPreferences(getCurrentPreferences());

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Lock down session permissions.
  // https://www.electronjs.org/docs/tutorial/security#4-handle-session-permission-requests-from-remote-content
  // https://github.com/doyensec/electronegativity/wiki/PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK
  session
    .fromPartition('secured-partition')
    .setPermissionRequestHandler((webContents, permission, callback) => {
      callback(false);
    });

  // Add Menu
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

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
  contents.on('will-navigate', (navEvent) => {
    navEvent.preventDefault();
  });
  contents.on('will-redirect', (navEvent) => {
    navEvent.preventDefault();
  });

  // https://electronjs.org/docs/tutorial/security#11-verify-webview-options-before-creation
  contents.on('will-attach-webview', (webEvent, webPreferences) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
  });

  // Block new windows from within the App
  // https://electronjs.org/docs/tutorial/security#13-disable-or-limit-creation-of-new-windows
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Add the list of handlers provided in the ElectronForce.handlers library.
const efHandlers = Object.getOwnPropertyNames(ipcFunctions.handlers);
efHandlers.forEach((value) => {
  ipcMain.on(value, ipcFunctions.handlers[value]);
});

// Send Preferences to the main window on request.
ipcMain.on('get_preferences', () => {
  const preferences = getCurrentPreferences();
  mainWindow.webContents.send('current_preferences', preferences);
});

// Find in Page IPC call.
ipcMain.on('find_text', (event, searchSettings) => {
  executeSearch(mainWindow.webContents, searchSettings.text, searchSettings.direction);
});

// Add Preference listeners.
ipcMain.on('preferences_load', loadPreferences);
ipcMain.on('preferences_save', savePreferences);
ipcMain.on('preferences_close', closePreferences);
