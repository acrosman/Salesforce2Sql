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
});
