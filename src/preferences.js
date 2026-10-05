const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  safeStorage,
} = require('electron');  // eslint-disable-line
const fs = require('fs-extra');

const oauth = require('./sf_oauth');

const appPath = app.getAppPath();
const settingsPath = path.join(app.getPath('userData'), 'preferences.json');
const oauthSettingsPath = path.join(app.getPath('userData'), 'oauth-preferences.bin');

// A list of menu item IDs to disable when preference window is open.
const nonPrefWindowItems = [
  'find-menu-item',
];

let prefWindow = null;
let mainWindow = null;

const setMainWindow = (win) => {
  mainWindow = win;
};

const defaultPreferences = () => ({
  theme: 'Cyborg',
  indexes: {
    externalIds: true,
    lookups: true,
    picklists: true,
  },
  picklists: {
    type: 'enum',
    unrestricted: true,
    ensureBlanks: true,
  },
  lookups: {
    type: 'char(18)',
  },
  defaults: {
    attemptSFValues: false,
    textEmptyString: false,
    checkboxDefaultFalse: true,
    suppressReadOnly: false,
    suppressAudit: false,
  },
  oauth: {
    hasCredentials: false,
    callbackPort: oauth.DEFAULT_CALLBACK_PORT,
  },
});

// Credentials kept for this session only, when OS encryption is unavailable.
let sessionCredentials = null;

/**
 * Reads client credentials from environment variables, if both are set.
 * @returns {{clientId: string, clientSecret: string}|null} The credentials, or null.
 */
const getEnvCredentials = () => {
  const clientId = process.env.SALESFORCE_CLIENT_ID || '';
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

/**
 * Reports whether OAuth client credentials have been saved, without decrypting
 * anything. Decrypting can prompt for OS keychain access, so status checks
 * only look for the encrypted file.
 * @returns {boolean} True when credentials are available.
 */
const hasOAuthCredentials = () => Boolean(getEnvCredentials())
  || Boolean(sessionCredentials)
  || fs.existsSync(oauthSettingsPath);

/**
 * Loads the OAuth client credentials, decrypting them if needed. Only call
 * this when the credentials are about to be used.
 * @returns {{clientId: string, clientSecret: string}} The credentials (empty when unavailable).
 */
const loadOAuthCredentials = () => {
  const empty = { clientId: '', clientSecret: '' };
  const envCredentials = getEnvCredentials();
  if (envCredentials) {
    return envCredentials;
  }
  if (sessionCredentials) {
    return sessionCredentials;
  }

  try {
    if (!fs.existsSync(oauthSettingsPath) || !safeStorage || !safeStorage.isEncryptionAvailable()) {
      return empty;
    }
    const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(oauthSettingsPath)));
    return {
      clientId: parsed.clientId || '',
      clientSecret: parsed.clientSecret || '',
    };
  } catch (err) {
    return empty;
  }
};

// The OAuth module asks for credentials only when a login starts.
oauth.setCredentialProvider(loadOAuthCredentials);

/**
 * Saves OAuth client credentials entered in Preferences. Blank fields keep the
 * stored values, so saving other preferences never touches encrypted storage.
 * @param {*} oauthSettings The oauth values from the Preferences window.
 */
const saveSecureOAuthSettings = (oauthSettings = {}) => {
  if (oauthSettings.clearCredentials) {
    sessionCredentials = null;
    if (fs.existsSync(oauthSettingsPath)) {
      fs.removeSync(oauthSettingsPath);
    }
    return;
  }

  let clientId = (oauthSettings.clientId || '').trim();
  let clientSecret = (oauthSettings.clientSecret || '').trim();

  // Nothing entered: keep what is stored without reading it.
  if (!clientId && !clientSecret) {
    return;
  }

  // Only one field entered: merge with the stored values, which requires
  // decrypting them.
  if (!clientId || !clientSecret) {
    const existing = loadOAuthCredentials();
    clientId = clientId || existing.clientId;
    clientSecret = clientSecret || existing.clientSecret;
  }

  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    sessionCredentials = { clientId, clientSecret };
    return;
  }

  fs.writeFileSync(oauthSettingsPath, safeStorage.encryptString(JSON.stringify({
    clientId,
    clientSecret,
  })));
};

/**
 * Removes client credential fields so they never reach preferences.json.
 * @param {*} oauthPrefs The oauth section of the preferences.
 * @returns The oauth preferences without credentials.
 */
const withoutCredentials = ({
  clientId,
  clientSecret,
  hasClientSecret,
  hasCredentials,
  clearCredentials,
  ...oauthPrefs
} = {}) => oauthPrefs;

const getCurrentPreferences = () => {
  // Ensure we have the settings file created.
  fs.ensureFileSync(settingsPath);

  const preferences = defaultPreferences();

  // Load any existing values.
  let settingsData = {};
  try {
    settingsData = JSON.parse(fs.readFileSync(settingsPath));
  } catch (err) {
    // Catch and release, we'll just use the defaults from there.
  }

  // Merge in settings that in the file and we know how to use.
  const values = Object.getOwnPropertyNames(preferences);
  for (let i = 0; i < values.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(settingsData, values[i])) {
      preferences[values[i]] = settingsData[values[i]];
    }
  }

  // The settings file holds only non-secret OAuth settings. Credentials stay
  // in encrypted storage and are only reported as present or not.
  const callbackPort = oauth.normalizeCallbackPort(preferences.oauth?.callbackPort);
  oauth.setCallbackPort(callbackPort);
  preferences.oauth = {
    ...withoutCredentials(preferences.oauth),
    callbackPort,
    hasCredentials: hasOAuthCredentials(),
  };

  return preferences;
};

const loadPreferences = () => {
  // Get our defaults.
  const preferences = getCurrentPreferences();
  prefWindow.webContents.send('preferences_data', preferences);
};

const savePreferences = (event, settingData = {}) => {
  const preferences = getCurrentPreferences();

  // Merge in settings that in the file and we know how to use.
  const values = Object.getOwnPropertyNames(preferences);
  for (let i = 0; i < values.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(settingData, values[i])) {
      preferences[values[i]] = settingData[values[i]];
    }
  }

  // Client credentials are only kept in encrypted storage.
  if (settingData.oauth) {
    saveSecureOAuthSettings(settingData.oauth);
  }
  const callbackPort = oauth.normalizeCallbackPort(preferences.oauth.callbackPort);
  oauth.setCallbackPort(callbackPort);
  preferences.oauth = {
    ...withoutCredentials(preferences.oauth),
    callbackPort,
  };
  fs.writeFileSync(settingsPath, JSON.stringify(preferences));
};

const closePreferences = () => {
  if (prefWindow) {
    prefWindow.close();
  }
  if (mainWindow) {
    mainWindow.webContents.send('current_preferences', getCurrentPreferences());
  }

  // Enable menu items that don't work in this context:
  const appMenu = Menu.getApplicationMenu();
  nonPrefWindowItems.forEach((element) => {
    appMenu.getMenuItemById(element).enabled = true;
  });
};

const openPreferences = () => {
  const htmlPath = `file://${appPath}/app/preferences.html`;
  if (!prefWindow || prefWindow.isDestroyed()) {
    prefWindow = new BrowserWindow({
      width: 550,
      height: 940,
      resizable: false,
      frame: false,
      webPreferences: {
        contextIsolation: true, // Enabling contextIsolation to protect against prototype pollution.
        disableBlinkFeatures: 'Auxclick', // See: https://github.com/doyensec/electronegativity/wiki/AUXCLICK_JS_CHECK
        enableRemoteModule: false, // Turn off remote to avoid temptation.
        nodeIntegration: false, // Disable nodeIntegration for security.
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        worldSafeExecuteJavaScript: true, // https://github.com/electron/electron/pull/24712
        preload: path.join(appPath, 'app/preferencesPreload.js'),
      },
    });
  }

  // Disable menu items that don't work in this context:
  const appMenu = Menu.getApplicationMenu();
  nonPrefWindowItems.forEach((element) => {
    appMenu.getMenuItemById(element).enabled = false;
  });

  // Display the window.
  prefWindow.loadURL(htmlPath);
  prefWindow.setMenuBarVisibility(false);
  prefWindow.show();
};

exports.setMainWindow = setMainWindow;
exports.getCurrentPreferences = getCurrentPreferences;
exports.openPreferences = openPreferences;
exports.loadPreferences = loadPreferences;
exports.savePreferences = savePreferences;
exports.closePreferences = closePreferences;
exports.loadOAuthCredentials = loadOAuthCredentials;
