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
    clientId: '',
    hasClientSecret: false,
    callbackPort: oauth.DEFAULT_CALLBACK_PORT,
  },
});

const getStoredOAuthSettings = () => {
  const envClientId = process.env.SALESFORCE_CLIENT_ID || '';
  const envClientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';

  if (envClientId || envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      hasClientSecret: Boolean(envClientSecret),
    };
  }

  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    return {
      clientId: '',
      clientSecret: '',
      hasClientSecret: false,
    };
  }

  try {
    if (!fs.existsSync(oauthSettingsPath)) {
      return {
        clientId: '',
        clientSecret: '',
        hasClientSecret: false,
      };
    }

    const encryptedData = fs.readFileSync(oauthSettingsPath);
    const rawData = safeStorage.decryptString(encryptedData);
    const parsed = JSON.parse(rawData);

    return {
      clientId: parsed.clientId || '',
      clientSecret: parsed.clientSecret || '',
      hasClientSecret: Boolean(parsed.clientSecret),
    };
  } catch (err) {
    return {
      clientId: '',
      clientSecret: '',
      hasClientSecret: false,
    };
  }
};

const updateOAuthConfig = () => {
  const oauthSettings = getStoredOAuthSettings();
  oauth.setCredentials(oauthSettings.clientId, oauthSettings.clientSecret);
  return oauthSettings;
};

const saveSecureOAuthSettings = (oauthSettings = {}) => {
  const existingSettings = getStoredOAuthSettings();
  const clientId = (oauthSettings.clientId || '').trim();
  let clientSecret = typeof oauthSettings.clientSecret === 'string'
    ? oauthSettings.clientSecret.trim()
    : '';

  if (!clientSecret && existingSettings.hasClientSecret && clientId === existingSettings.clientId) {
    clientSecret = existingSettings.clientSecret;
  }

  if (!clientId && !clientSecret) {
    if (fs.existsSync(oauthSettingsPath)) {
      fs.removeSync(oauthSettingsPath);
    }
    oauth.setCredentials('', '');
    return {
      clientId: '',
      hasClientSecret: false,
    };
  }

  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    oauth.setCredentials(clientId, clientSecret);
    return {
      clientId,
      hasClientSecret: Boolean(clientSecret),
    };
  }

  const encryptedData = safeStorage.encryptString(JSON.stringify({
    clientId,
    clientSecret,
  }));

  fs.writeFileSync(oauthSettingsPath, encryptedData);
  oauth.setCredentials(clientId, clientSecret);

  return {
    clientId,
    hasClientSecret: Boolean(clientSecret),
  };
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

  // The settings file holds only non-secret OAuth settings. Credentials come
  // from encrypted storage.
  const callbackPort = oauth.normalizeCallbackPort(preferences.oauth?.callbackPort);
  oauth.setCallbackPort(callbackPort);
  const oauthCredentials = updateOAuthConfig();
  preferences.oauth = {
    ...withoutCredentials(preferences.oauth),
    callbackPort,
    clientId: oauthCredentials.clientId,
    hasClientSecret: oauthCredentials.hasClientSecret,
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
      height: 900,
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
exports.updateOAuthConfig = updateOAuthConfig;
