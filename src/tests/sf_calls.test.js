// FS is used to load samples from file.
const fs = require('fs');

// Mock knex module
jest.mock('knex');

// Mock jsforce module
jest.mock('jsforce');

// The actual module we're testing.
const sfcalls = require('../sf_calls');

// Provide a basic test of public elements of the module.
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
test('Validate existence of assumed internals', () => {
  // Checking the existing of the four main variables.
  expect(sfcalls.__get__('sfConnections')).toStrictEqual({});
  expect(sfcalls.__get__('proposedSchema')).toStrictEqual({});
  expect(sfcalls.__get__('mainWindow')).toBe(null);
  expect(sfcalls.__get__('preferences')).toBe(null);
  // Make sure the resolver list exists by checking one arbitrarily selected property.
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
    suppressReadOnly: false,
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

// Test the helper that pulls picklist values.
test('Test Picklist Value Extraction', () => {
  const sampleValues = [
    {
      active: true,
      defaultValue: false,
      label: 'Prospect',
      validFor: null,
      value: 'Prospect',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Field with \' in it',
      validFor: null,
      value: 'Test\'s',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Duplicate',
      validFor: null,
      value: 'Duplicate',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Duplicate',
      validFor: null,
      value: 'Duplicate',
    },
  ];

  const extractPicklistValues = sfcalls.__get__('extractPicklistValues');
  const testResult = extractPicklistValues(sampleValues);
  expect(testResult).toHaveLength(3);
  expect(testResult[0]).toBe('Prospect');
  expect(testResult[1]).toBe('Test\\\'s');
  expect(testResult[2]).toBe('Duplicate');
});

test('Test schema construction for a field', (done) => {
  // Get our test function.
  const buildFields = sfcalls.__get__('buildFields');

  // Load the sample responses.
  fs.readFile('src/tests/sampleSObjectDescribes.json', (err, data) => {
    done();
    if (err) {
      throw new Error(`Unable to load sample file: ${err}`);
    }

    const sampleSchema = JSON.parse(data);
    sfcalls.setPreferences(samplePrefs);
    let testResult = buildFields(sampleSchema.Account.fields);
    expect(testResult).toHaveProperty('Id');
    expect(testResult).toHaveProperty('Id.size', 18);
    expect(testResult).toHaveProperty('Id.type', 'id');
    expect(testResult).toHaveProperty('Id.name', 'Id');
    expect(testResult).toHaveProperty('Name');
    expect(testResult).toHaveProperty('Name.size', 255);
    expect(testResult).toHaveProperty('Name.type', 'string');
    expect(testResult).toHaveProperty('Name.name', 'Name');

    testResult = buildFields(sampleSchema.Contact.fields);
    expect(testResult).toHaveProperty('Id');
    expect(testResult).toHaveProperty('Id.size', 18);
    expect(testResult).toHaveProperty('Id.type', 'id');
    expect(testResult).toHaveProperty('Id.name', 'Id');
    expect(testResult).toHaveProperty('Name');
    expect(testResult).toHaveProperty('Name.size', 255);
    expect(testResult).toHaveProperty('Name.type', 'string');
    expect(testResult).toHaveProperty('Name.name', 'Name');
  });
});

// Add this test after other tests
test('Test createKnexConnection', () => {
  const settings = {
    type: 'mysql',
    host: 'localhost',
    username: 'testuser',
    password: 'testpass',
    dbname: 'testdb',
    port: 3306,
    timeout: 1000,
    pool: 10,
    fileName: null,
  };

  const createKnexConnection = sfcalls.__get__('createKnexConnection');
  const connection = createKnexConnection(settings);

  // Verify the connection was created with correct config
  expect(connection.client).toBe('mysql');
  expect(connection.connection).toEqual({
    host: 'localhost',
    user: 'testuser',
    password: 'testpass',
    database: 'testdb',
    port: 3306,
    filename: null,
  });
});

// Add after the previous test
test('Test createKnexConnection with SQLite', () => {
  const settings = {
    type: 'sqlite3',
    fileName: '/path/to/test.db',
    timeout: 1000,
    pool: 10
  };

  const createKnexConnection = sfcalls.__get__('createKnexConnection');
  const connection = createKnexConnection(settings);

  // Verify the connection was created with correct config
  expect(connection.client).toBe('sqlite3');
  expect(connection.connection).toEqual({
    host: undefined,
    user: undefined,
    password: undefined,
    database: undefined,
    port: undefined,
    filename: '/path/to/test.db'
  });
});
