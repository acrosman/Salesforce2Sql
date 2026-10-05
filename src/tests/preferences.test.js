jest.mock('fs-extra'); // this auto mocks all methods on fs-extra

const preferences = require('../preferences');

test('Validate exports', () => {
  expect(preferences).toHaveProperty('setMainWindow');
  expect(preferences).toHaveProperty('getCurrentPreferences');
  expect(preferences).toHaveProperty('openPreferences');
  expect(preferences).toHaveProperty('loadPreferences');
  expect(preferences).toHaveProperty('savePreferences');
  expect(preferences).toHaveProperty('closePreferences');
});

// There are a series of internal values for the module. Ensure they are there.
// Several are assumed and leveraged in later tests.
test('Validate existence of assumed internals', () => {
  // Checking the existing of the four main variables.
  expect(preferences.__get__('settingsPath')).toEqual(expect.stringContaining('preferences.json'));
  expect(preferences.__get__('nonPrefWindowItems')).toEqual(expect.arrayContaining(['find-menu-item']));
  expect(preferences.__get__('prefWindow')).toBe(null);
  expect(preferences.__get__('mainWindow')).toBe(null);
});

test('Check SetWindow', () => {
  // The set window does no validation, so we can set it to any object here.
  const myTestWindow = {
    testwindow: 1,
  };
  expect(preferences.__get__('mainWindow')).toBe(null);
  preferences.setMainWindow(myTestWindow);
  expect(preferences.__get__('mainWindow')).toHaveProperty('testwindow', 1);
});

test('Check SetPreferences', () => {
  const testPrefs = preferences.getCurrentPreferences();
  expect(testPrefs).toHaveProperty('theme');
  expect(testPrefs).toHaveProperty('indexes');
  expect(testPrefs).toHaveProperty('picklists');
  expect(testPrefs).toHaveProperty('lookups');
  expect(testPrefs).toHaveProperty('defaults');
  expect(testPrefs).toHaveProperty('oauth');
  expect(testPrefs.indexes).toHaveProperty('externalIds');
  expect(testPrefs.indexes).toHaveProperty('lookups');
  expect(testPrefs.indexes).toHaveProperty('picklists');
  expect(testPrefs.picklists).toHaveProperty('type');
  expect(testPrefs.picklists).toHaveProperty('unrestricted');
  expect(testPrefs.picklists).toHaveProperty('ensureBlanks');
  expect(testPrefs.lookups).toHaveProperty('type');
  expect(testPrefs.defaults).toHaveProperty('attemptSFValues');
  expect(testPrefs.defaults).toHaveProperty('textEmptyString');
  expect(testPrefs.defaults).toHaveProperty('suppressReadOnly');
  expect(testPrefs.defaults).toHaveProperty('suppressAudit');
  expect(testPrefs.oauth).toHaveProperty('hasCredentials');
  expect(testPrefs.oauth).toHaveProperty('callbackPort');
});

test('OAuth callback port defaults to 3835', () => {
  const testPrefs = preferences.getCurrentPreferences();
  expect(testPrefs.oauth.callbackPort).toBe(3835);
});

test('OAuth callback port is read from the settings file and applied to the OAuth module', () => {
  const fs = require('fs-extra'); // eslint-disable-line global-require
  const oauth = require('../sf_oauth'); // eslint-disable-line global-require
  fs.readFileSync.mockReturnValueOnce(JSON.stringify({ oauth: { callbackPort: 4100 } }));

  const testPrefs = preferences.getCurrentPreferences();

  expect(testPrefs.oauth.callbackPort).toBe(4100);
  expect(oauth.__get__('oauthSettings').callbackPort).toBe(4100);
  oauth.setCallbackPort(3835);
});

test('savePreferences keeps client credentials out of preferences.json', () => {
  const fs = require('fs-extra'); // eslint-disable-line global-require
  fs.writeFileSync.mockClear();

  preferences.savePreferences({}, {
    theme: 'Cyborg',
    oauth: { clientId: 'my-client-id', clientSecret: 'my-secret', callbackPort: 'not-a-port' },
  });

  const prefsWrite = fs.writeFileSync.mock.calls
    .find((call) => `${call[0]}`.endsWith('preferences.json'));
  const saved = JSON.parse(prefsWrite[1]);
  expect(saved.oauth).toEqual({ callbackPort: 3835 });
  expect(prefsWrite[1]).not.toContain('my-client-id');
  expect(prefsWrite[1]).not.toContain('my-secret');
});

test('getCurrentPreferences ignores credentials left in the settings file', () => {
  const fs = require('fs-extra'); // eslint-disable-line global-require
  fs.readFileSync.mockReturnValueOnce(JSON.stringify({
    oauth: { clientId: 'stale-id', clientSecret: 'stale-secret', callbackPort: 3835 },
  }));

  const testPrefs = preferences.getCurrentPreferences();

  expect(testPrefs.oauth).not.toHaveProperty('clientId');
  expect(testPrefs.oauth).not.toHaveProperty('clientSecret');
});

test('savePreferences without oauth settings keeps stored credentials', () => {
  const fs = require('fs-extra'); // eslint-disable-line global-require
  fs.removeSync.mockClear();
  fs.existsSync.mockReturnValue(true);

  preferences.savePreferences({}, { theme: 'Cyborg' });

  expect(fs.removeSync).not.toHaveBeenCalled();
  fs.existsSync.mockReset();
});

// Reading encrypted credentials can prompt for OS keychain access, so it must
// only happen when the credentials are about to be used.
describe('OAuth credentials are loaded only when needed', () => {
  const fs = require('fs-extra'); // eslint-disable-line global-require
  const { safeStorage } = require('electron'); // eslint-disable-line global-require
  const oauth = require('../sf_oauth'); // eslint-disable-line global-require

  beforeEach(() => {
    fs.existsSync.mockReset();
    fs.removeSync.mockClear();
    fs.writeFileSync.mockClear();
    safeStorage.isEncryptionAvailable.mockClear();
    safeStorage.decryptString.mockClear();
    safeStorage.encryptString.mockClear();
  });

  test('reading preferences reports saved credentials without touching safeStorage', () => {
    fs.existsSync.mockImplementation((file) => `${file}`.endsWith('oauth-preferences.bin'));

    const testPrefs = preferences.getCurrentPreferences();

    expect(testPrefs.oauth.hasCredentials).toBe(true);
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
  });

  test('reading preferences reports missing credentials', () => {
    fs.existsSync.mockReturnValue(false);
    expect(preferences.getCurrentPreferences().oauth.hasCredentials).toBe(false);
  });

  test('saving preferences with blank credential fields does not touch safeStorage', () => {
    fs.existsSync.mockReturnValue(true);

    preferences.savePreferences({}, {
      theme: 'Cyborg',
      oauth: { clientId: '', clientSecret: '', callbackPort: 3835 },
    });

    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
    expect(safeStorage.encryptString).not.toHaveBeenCalled();
    expect(fs.removeSync).not.toHaveBeenCalled();
  });

  test('saving both credentials encrypts them without reading the old ones', () => {
    preferences.savePreferences({}, {
      oauth: { clientId: 'new-id', clientSecret: 'new-secret', callbackPort: 3835 },
    });

    expect(safeStorage.decryptString).not.toHaveBeenCalled();
    expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify({
      clientId: 'new-id',
      clientSecret: 'new-secret',
    }));
  });

  test('saving one credential merges with the stored value', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValueOnce('{}'); // preferences.json
    fs.readFileSync.mockReturnValueOnce(Buffer.from(JSON.stringify({
      clientId: 'old-id',
      clientSecret: 'old-secret',
    })));

    preferences.savePreferences({}, {
      oauth: { clientId: '', clientSecret: 'new-secret', callbackPort: 3835 },
    });

    expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify({
      clientId: 'old-id',
      clientSecret: 'new-secret',
    }));
  });

  test('remove saved credentials deletes the encrypted file', () => {
    fs.existsSync.mockReturnValue(true);

    preferences.savePreferences({}, {
      oauth: { clearCredentials: true, callbackPort: 3835 },
    });

    expect(fs.removeSync).toHaveBeenCalledWith(expect.stringContaining('oauth-preferences.bin'));
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
  });

  test('the OAuth module decrypts credentials only when a login asks for them', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValueOnce(Buffer.from(JSON.stringify({
      clientId: 'stored-id',
      clientSecret: 'stored-secret',
    })));

    const provider = oauth.__get__('credentialProvider');
    expect(safeStorage.decryptString).not.toHaveBeenCalled();

    expect(provider()).toEqual({ clientId: 'stored-id', clientSecret: 'stored-secret' });
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(1);
  });
});
