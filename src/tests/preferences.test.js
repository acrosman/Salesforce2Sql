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
  expect(testPrefs.oauth).toHaveProperty('clientId');
  expect(testPrefs.oauth).toHaveProperty('hasClientSecret');
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

  expect(testPrefs.oauth.clientId).not.toBe('stale-id');
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
