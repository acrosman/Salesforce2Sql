const sfcalls = require('../sf_calls');

test('Validate exports', () => {
  // Validate the main elements of the library are here.
  expect(sfcalls).toHaveProperty('handlers');
  expect(sfcalls).toHaveProperty('setwindow');
  expect(sfcalls).toHaveProperty('setPreferences');

  // Validate the handlers list is correct.
  const handlerList = [
    'knex_schema',
    'load_schema',
    'log_message',
    'save_ddl_sql',
    'save_schema',
    'sf_describeGlobal',
    'sf_getObjectFields',
    'sf_login',
    'sf_logout',
  ];
  for (let i = 0; i < handlerList.length; i += 1) {
    expect(sfcalls.handlers).toHaveProperty(handlerList[i]);
  }
});

// There are a series of internal values for the module. Ensure they are there.
// Several are assumed and leveraged in later tests.
test('Validate existance of assumed internals', () => {
  // Checking the existing of the four main variables.
  expect(sfcalls.__get__('sfConnections')).toStrictEqual({});
  expect(sfcalls.__get__('proposedSchema')).toStrictEqual({});
  expect(sfcalls.__get__('mainWindow')).toBe(null);
  expect(sfcalls.__get__('preferences')).toBe(null);
  // Make sure the resolver list exists by checking one arbitrarly selected property.
  expect(sfcalls.__get__('typeResolverBases')).toHaveProperty('reference', 'reference');
});

test('Check SetWindow', () => {
  // The set window does no validation, so we cna set it to any object here.
  const myTestWindow = {
    testwindow: 1,
  };
  expect(sfcalls.__get__('mainWindow')).toBe(null);
  sfcalls.setwindow(myTestWindow);
  expect(sfcalls.__get__('mainWindow')).toHaveProperty('testwindow', 1);
});

// A sample set of Preferences for use in this test and when testing other functions that need them.
const samplePrefs = {
  theme: 'Cyborg',
  indexes: {
    picklists: true,
    lookups: true,
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
    supressReadOnly: false,
  },
};

test('Check SetPreferences', () => {
  // Send an object with a set of preferences, can use again for other testing.
  expect(sfcalls.__get__('preferences')).toBe(null);
  sfcalls.setPreferences(samplePrefs);
  expect(sfcalls.__get__('preferences')).toHaveProperty('theme');
});

test('Test resolveFieldType', () => {
  // Get the current list of mapping default values.
  const defaultTypeMap = sfcalls.__get__('typeResolverBases');

  // Set with the default values above, then we'll try some variations.
  sfcalls.setPreferences(samplePrefs);
  const resolveFunction = sfcalls.__get__('resolveFieldType');
  Object.entries(defaultTypeMap).forEach((element) => {
    expect(resolveFunction(element[0])).toBe(element[1]);
  });

  // Tweak for picklists when set to be strings.
  samplePrefs.picklists.type = 'string';
  sfcalls.setPreferences(samplePrefs);
  expect(resolveFunction('picklist')).toBe('string');

  // Set Ids to be full strings instead of char(18) as needed.
  samplePrefs.lookups.type = 'varchar(255)';
  sfcalls.setPreferences(samplePrefs);
  expect(resolveFunction('reference')).toBe('string');

});
