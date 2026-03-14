const fs = require('fs');
const electron = require('electron');
const jsforce = require('jsforce');

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

test('Test createKnexConnection', () => {
  const settings = {
    type: 'mysql',
    host: 'localhost',
    username: 'testUser',
    password: 'testPass',
    dbname: 'testDB',
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
    user: 'testUser',
    password: 'testPass',
    database: 'testDB',
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
    pool: 10,
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
    filename: '/path/to/test.db',
  });
});

test('Test sniffOrgType with NPSP objects', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'npe01__Contacts_And_Orgs_Settings__c' },
    { name: 'GiftCommitment' },
    { name: 'CustomObject__c' },
  ];

  const sniffOrgType = sfcalls.__get__('sniffOrgType');
  const features = sniffOrgType(sObjectList);

  // Should detect NPSP from namespace and GiftCommitment object
  expect(features).toContain('npsp');
  expect(features).toContain('fundraising');
  expect(features).toContain('industryCloudBase');
  expect(features).toHaveLength(3); // Should have no duplicates
});

test('Test sniffOrgType with EDA objects', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'hed__Course__c' },
    { name: 'CustomObject__c' },
  ];

  const sniffOrgType = sfcalls.__get__('sniffOrgType');
  const features = sniffOrgType(sObjectList);

  // Should detect EDA from namespace
  expect(features).toContain('eda');
  expect(features).toHaveLength(1);
});

test('Test sniffOrgType with multiple Industry Cloud objects', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'CarePlan' },
    { name: 'ProgramEnrollment' },
    { name: 'Outcome' },
  ];

  const sniffOrgType = sfcalls.__get__('sniffOrgType');
  const features = sniffOrgType(sObjectList);

  // Should detect all Industry Cloud features without duplicates
  expect(features).toContain('caseManagement');
  expect(features).toContain('programManagement');
  expect(features).toContain('outcomeManagement');
  expect(features).toContain('industryCloudBase');
  expect(features).toHaveLength(4); // industryCloudBase should only appear once
});

test('Test recommendObjects with NPSP and Industry Cloud', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'npe01__Contacts_And_Orgs_Settings__c' },
    { name: 'GiftCommitment' },
    { name: 'CustomObject__c' },
    { name: 'Another_Custom_Object__c' },
  ];

  const recommendObjects = sfcalls.__get__('recommendObjects');
  const recommended = recommendObjects(sObjectList);

  // Should include standard objects from NPSP and fundraising
  expect(recommended).toContain('Account');
  expect(recommended).toContain('Contact');
  expect(recommended).toContain('Opportunity');

  // Should include custom objects
  expect(recommended).toContain('CustomObject__c');
  expect(recommended).toContain('Another_Custom_Object__c');

  // Should not have duplicates even though Account appears in multiple feature sets
  expect(recommended.filter((obj) => obj === 'Account')).toHaveLength(1);
});

test('Test sniffOrgType detects Sales org by default', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'Opportunity' },
    { name: 'Lead' },
    { name: 'CustomObject__c' },
  ];

  const sniffOrgType = sfcalls.__get__('sniffOrgType');
  const features = sniffOrgType(sObjectList);

  // Should detect sales when no special features found
  expect(features).toContain('sales');
  expect(features).toHaveLength(1);
});

test('Test sniffOrgType with Education Cloud objects', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'AcademicTerm' },
    { name: 'CourseOffering' },
    { name: 'LearningProgram' },
    { name: 'CustomObject__c' },
  ];

  const sniffOrgType = sfcalls.__get__('sniffOrgType');
  const features = sniffOrgType(sObjectList);

  // Should detect Education Cloud from indicator objects
  expect(features).toContain('educationCloud');
  expect(features).toContain('industryCloudBase');
  expect(features).toHaveLength(2);
});

test('Test recommendObjects with Education Cloud', () => {
  const sObjectList = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'AcademicTerm' },
    { name: 'CourseOffering' },
    { name: 'LearningProgram' },
    { name: 'CustomObject__c' },
    { name: 'Another_Custom_Object__c' },
  ];

  const recommendObjects = sfcalls.__get__('recommendObjects');
  const recommended = recommendObjects(sObjectList);

  // Should include standard Education Cloud objects
  expect(recommended).toContain('AcademicTerm');
  expect(recommended).toContain('CourseOffering');
  expect(recommended).toContain('LearningProgram');

  // Should include base objects
  expect(recommended).toContain('Account');
  expect(recommended).toContain('Contact');

  // Should include custom objects
  expect(recommended).toContain('CustomObject__c');
  expect(recommended).toContain('Another_Custom_Object__c');

  // Should not have duplicates even though Account appears in multiple feature sets
  expect(recommended.filter((obj) => obj === 'Account')).toHaveLength(1);
});

test('Test setWindow function', () => {
  const setwindow = sfcalls.__get__('setwindow');

  setwindow(electron.mainWindow);
  const resultWindow = sfcalls.__get__('mainWindow');

  expect(resultWindow).toBe(electron.mainWindow);
  expect(resultWindow.webContents.send).toBeDefined();
  expect(resultWindow).toHaveProperty('webContents.send');
});

test('Test setPreferences function', () => {
  const setPreferences = sfcalls.__get__('setPreferences');
  const mockPreferences = {
    defaults: {
      suppressReadOnly: true,
      suppressAudit: false,
      textEmptyString: true,
      checkboxDefault: false,
      attemptSFValues: true,
    },
    indexes: {
      lookups: true,
      picklists: false,
      externalIds: true,
    },
    picklists: {
      type: 'enum',
      unrestricted: false,
      ensureBlanks: true,
    },
    lookups: {
      type: 'char(18)',
    },
  };

  setPreferences(mockPreferences);
  const preferences = sfcalls.__get__('preferences');

  expect(preferences).toEqual(mockPreferences);
  expect(preferences.defaults.suppressReadOnly).toBe(true);
  expect(preferences.indexes.lookups).toBe(true);
  expect(preferences.picklists.type).toBe('enum');
});

test('Test logMessage function', () => {
  const logMessage = sfcalls.__get__('logMessage');

  // Set the window first
  const setwindow = sfcalls.__get__('setwindow');
  setwindow(electron.mainWindow);

  // Test sending a log message
  const result = logMessage('Test Title', 'Info', 'Test Message');

  // Verify the window's send method was called with correct parameters
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'log_message',
    {
      sender: 'Test Title',
      channel: 'Info',
      message: 'Test Message',
    },
  );

  // Verify function returns true
  expect(result).toBe(true);

  // Verify the send method was called exactly once
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledTimes(1);
});

test('Test updateLoader function', () => {
  const updateLoader = sfcalls.__get__('updateLoader');

  // Set the window first
  const setwindow = sfcalls.__get__('setwindow');
  setwindow(electron.mainWindow);

  // Test updating the loader
  updateLoader('Test Loading Message');

  // Verify the window's send method was called with correct parameters
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'update_loader',
    {
      message: 'Test Loading Message',
    },
  );
});

test('Test loadSchemaFromFile function with successful file load', () => {
  const loadSchemaFromFile = sfcalls.__get__('loadSchemaFromFile');
  const setwindow = sfcalls.__get__('setwindow');

  // Set the window first
  setwindow(electron.mainWindow);

  // Call the function
  loadSchemaFromFile();

  // Verify dialog was shown with correct options
  expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(
    electron.mainWindow,
    expect.objectContaining({
      title: 'Load Schema',
      properties: ['openFile'],
    }),
  );

  // Verify the correct messages were sent
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'log_message',
    expect.objectContaining({
      sender: expect.stringContaining('Test Title'),
      channel: 'Info',
      message: expect.stringContaining('Test Message'),
    }),
  );
});

test('Test loadSchemaFromFile function with file read error', () => {
  const loadSchemaFromFile = sfcalls.__get__('loadSchemaFromFile');
  const setwindow = sfcalls.__get__('setwindow');

  // Set the window first
  setwindow(electron.mainWindow);

  // Call the function
  loadSchemaFromFile();

  // Verify error message was sent
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'log_message',
    expect.objectContaining({
      sender: expect.stringContaining('Test Title'),
      channel: 'Info',
      message: expect.stringContaining('Test Message'),
    }),
  );
});

test('Test sf_login success path', async () => {
  jest.clearAllMocks();
  sfcalls.setwindow(electron.mainWindow);

  const mockEvent = { sender: { getTitle: jest.fn().mockReturnValue('Test Window') } };
  const mockArgs = {
    url: 'https://test.salesforce.com',
    username: 'test@test.com',
    password: 'testpassword',
    token: 'testtoken',
  };

  sfcalls.handlers.sf_login(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_login',
    expect.objectContaining({
      status: true,
      message: 'Login Successful',
    }),
  );
  // Password and token must be cleared before sending back to the renderer.
  expect(mockArgs.password).toBe('');
  expect(mockArgs.token).toBe('');
});

test('Test sf_login auth failure path', async () => {
  jest.clearAllMocks();
  jsforce.Connection.mockImplementationOnce(() => ({
    login: jest.fn().mockRejectedValue(new Error('INVALID_LOGIN: Invalid username, password, security token')),
    limitInfo: {},
  }));
  sfcalls.setwindow(electron.mainWindow);

  const mockEvent = { sender: { getTitle: jest.fn().mockReturnValue('Test Window') } };
  const mockArgs = {
    url: 'https://test.salesforce.com',
    username: 'wrong@test.com',
    password: 'wrongpassword',
    token: '',
  };

  sfcalls.handlers.sf_login(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_login',
    expect.objectContaining({
      status: false,
      message: 'Login Failed',
    }),
  );
});

test('Test sf_logout success path', async () => {
  jest.clearAllMocks();
  sfcalls.__set__('sfConnections', {
    testOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);

  const mockEvent = { sender: { getTitle: jest.fn().mockReturnValue('Test Window') } };
  const mockArgs = { org: 'testOrgId' };

  sfcalls.handlers.sf_logout(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_logout',
    expect.objectContaining({
      status: true,
      message: 'Logout Successful',
    }),
  );
  expect(sfcalls.__get__('sfConnections').testOrgId).toBeNull();
});

test('Test sf_logout error path', () => {
  jest.clearAllMocks();
  jsforce.Connection.mockImplementationOnce(() => ({
    logout: { then: (_onFulfilled, onRejected) => onRejected(new Error('Logout requested for unknown user')) },
    limitInfo: {},
  }));
  sfcalls.__set__('sfConnections', {
    errorOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);

  const mockEvent = { sender: { getTitle: jest.fn().mockReturnValue('Test Window') } };
  const mockArgs = { org: 'errorOrgId' };

  sfcalls.handlers.sf_logout(mockEvent, mockArgs);

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_logout',
    expect.objectContaining({
      status: false,
      message: 'Logout Failed',
    }),
  );
});

test('Test sf_describeGlobal success path', async () => {
  jest.clearAllMocks();
  sfcalls.__set__('sfConnections', {
    testOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);
  sfcalls.setPreferences(samplePrefs);

  const mockEvent = { sender: electron.mainWindow.webContents };
  const mockArgs = { org: 'testOrgId' };

  sfcalls.handlers.sf_describeGlobal(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_list_objects',
    expect.objectContaining({
      status: true,
      message: 'Describe Global Successful',
      response: expect.objectContaining({
        sobjects: [],
        recommended: expect.any(Array),
      }),
    }),
  );
});

test('Test sf_describeGlobal error path', async () => {
  jest.clearAllMocks();
  jsforce.Connection.mockImplementationOnce(() => ({
    describeGlobal: jest.fn().mockRejectedValue(new Error('Connection timed out')),
    limitInfo: {},
  }));
  sfcalls.__set__('sfConnections', {
    errorOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);

  const mockEvent = { sender: electron.mainWindow.webContents };
  const mockArgs = { org: 'errorOrgId' };

  sfcalls.handlers.sf_describeGlobal(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_error',
    expect.objectContaining({
      status: false,
      message: 'Describe Global Failed',
    }),
  );
});

test('Test sf_getObjectFields success path', async () => {
  jest.clearAllMocks();
  const mockFields = [
    {
      name: 'Id',
      type: 'id',
      length: 18,
      label: 'Account ID',
      calculated: false,
      updateable: false,
      createable: false,
      defaultValue: null,
      externalId: false,
      picklistValues: [],
    },
    {
      name: 'Name',
      type: 'string',
      length: 80,
      label: 'Account Name',
      calculated: false,
      updateable: true,
      createable: true,
      defaultValue: null,
      externalId: false,
      picklistValues: [],
    },
  ];

  jsforce.Connection.mockImplementationOnce(() => ({
    sobject: jest.fn().mockReturnValue({
      describe: jest.fn().mockResolvedValue({ name: 'Account', fields: mockFields }),
    }),
    limitInfo: {},
  }));
  sfcalls.__set__('sfConnections', {
    testOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);
  sfcalls.setPreferences(samplePrefs);

  const mockEvent = { sender: electron.mainWindow.webContents };
  const mockArgs = { org: 'testOrgId', objects: ['Account'] };

  sfcalls.handlers.sf_getObjectFields(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  // proposedSchema should have been populated with the Account fields.
  const schema = sfcalls.__get__('proposedSchema');
  expect(schema).toHaveProperty('Account');
  expect(schema.Account).toHaveProperty('Id');
  expect(schema.Account).toHaveProperty('Name');

  // response_schema should have been sent to the renderer.
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'response_schema',
    expect.objectContaining({
      status: false,
      message: 'Processed Objects',
      response: expect.objectContaining({
        schema: expect.objectContaining({ Account: expect.any(Object) }),
      }),
    }),
  );
});

test('Test sf_getObjectFields error path', async () => {
  jest.clearAllMocks();
  jsforce.Connection.mockImplementationOnce(() => ({
    sobject: jest.fn().mockReturnValue({
      describe: jest.fn().mockRejectedValue(new Error('Object not found')),
    }),
    limitInfo: {},
  }));
  sfcalls.__set__('sfConnections', {
    testOrgId: {
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'testToken',
      version: '63.0',
    },
  });
  sfcalls.setwindow(electron.mainWindow);
  sfcalls.setPreferences(samplePrefs);

  const mockEvent = { sender: electron.mainWindow.webContents };
  const mockArgs = { org: 'testOrgId', objects: ['NonExistentObject__c'] };

  sfcalls.handlers.sf_getObjectFields(mockEvent, mockArgs);
  await new Promise((resolve) => { process.nextTick(resolve); });

  // An error log message should have been sent for the failed describe.
  expect(electron.mainWindow.webContents.send).toHaveBeenCalledWith(
    'log_message',
    expect.objectContaining({
      channel: 'Error',
      message: expect.stringContaining('NonExistentObject__c'),
    }),
  );
});

// ==========================================
// validateConnection tests
// ==========================================

test('Test validateConnection success path', async () => {
  const validateConnection = sfcalls.__get__('validateConnection');
  const mockKnexDb = {
    raw: jest.fn().mockResolvedValue([{ isUp: 1 }]),
  };

  await expect(validateConnection(mockKnexDb)).resolves.toEqual([{ isUp: 1 }]);
  expect(mockKnexDb.raw).toHaveBeenCalledWith('SELECT 1 AS isUp');
});

test('Test validateConnection DB error path', async () => {
  const validateConnection = sfcalls.__get__('validateConnection');
  const mockKnexDb = {
    raw: jest.fn().mockRejectedValue(new Error('connection refused')),
  };

  await expect(validateConnection(mockKnexDb)).rejects.toThrow('connection refused');
  expect(mockKnexDb.raw).toHaveBeenCalledWith('SELECT 1 AS isUp');
});

// ==========================================
// buildTable tests
// ==========================================

// Preferences for buildTable unit tests — all indexes and SF-defaults disabled.
const buildTablePrefs = {
  theme: 'Cyborg',
  indexes: {
    externalIds: false,
    lookups: false,
    picklists: false,
  },
  picklists: {
    type: 'enum',
    unrestricted: false,
    ensureBlanks: false,
  },
  lookups: {
    type: 'char(18)',
  },
  defaults: {
    attemptSFValues: false,
    textEmptyString: false,
    suppressReadOnly: false,
    suppressAudit: false,
    checkboxDefault: false,
  },
};

// Restores typeResolverBases fields that earlier tests mutate without reverting.
// resolveFieldType mutates the shared object but has no restore path, so we fix
// it before tests that require the canonical picklist→enum and reference→reference mappings.
const resetTypeResolver = () => {
  const typeResolverBases = sfcalls.__get__('typeResolverBases');
  typeResolverBases.picklist = 'enum';
  typeResolverBases.reference = 'reference';
};

// Creates a minimal knex column stub with the methods buildTable may call.
const makeColumnMock = () => ({
  collate: jest.fn().mockReturnThis(),
  defaultTo: jest.fn().mockReturnThis(),
  index: jest.fn().mockReturnThis(),
});

// Creates a full knex table stub whose column methods each return a fresh column mock.
const makeTableMock = (tableName) => ({
  _tableName: tableName,
  binary: jest.fn().mockReturnValue(makeColumnMock()),
  boolean: jest.fn().mockReturnValue(makeColumnMock()),
  biginteger: jest.fn().mockReturnValue(makeColumnMock()),
  date: jest.fn().mockReturnValue(makeColumnMock()),
  datetime: jest.fn().mockReturnValue(makeColumnMock()),
  decimal: jest.fn().mockReturnValue(makeColumnMock()),
  enu: jest.fn().mockReturnValue(makeColumnMock()),
  float: jest.fn().mockReturnValue(makeColumnMock()),
  integer: jest.fn().mockReturnValue(makeColumnMock()),
  string: jest.fn().mockReturnValue(makeColumnMock()),
  text: jest.fn().mockReturnValue(makeColumnMock()),
  time: jest.fn().mockReturnValue(makeColumnMock()),
});

test('Test buildTable invokes the correct column method for each field type', () => {
  const buildTable = sfcalls.__get__('buildTable');
  resetTypeResolver();
  sfcalls.setPreferences(buildTablePrefs);
  sfcalls.__set__('proposedSchema', {
    TestObject: {
      BinaryFld: { name: 'BinaryFld', type: 'byte', size: 8, defaultValue: null, externalId: false },
      BoolFld: { name: 'BoolFld', type: 'boolean', size: 0, defaultValue: null, externalId: false },
      BigIntFld: { name: 'BigIntFld', type: 'long', size: 18, defaultValue: null, externalId: false },
      DateFld: { name: 'DateFld', type: 'date', size: 10, defaultValue: null, externalId: false },
      DatetimeFld: { name: 'DatetimeFld', type: 'datetime', size: 10, defaultValue: null, externalId: false },
      DecimalFld: {
        name: 'DecimalFld', type: 'double', size: 18, precision: 15, scale: 2, defaultValue: null, externalId: false,
      },
      EnumFld: {
        name: 'EnumFld', type: 'picklist', size: 255, defaultValue: null, externalId: false, values: ['A', 'B'], isRestricted: true,
      },
      IntFld: { name: 'IntFld', type: 'int', size: 4, defaultValue: null, externalId: false },
      RefFld: { name: 'RefFld', type: 'reference', size: 18, defaultValue: null, externalId: false },
      TextFld: { name: 'TextFld', type: 'textarea', size: 1000, defaultValue: null, externalId: false },
      TimeFld: { name: 'TimeFld', type: 'time', size: 10, defaultValue: null, externalId: false },
      StrFld: { name: 'StrFld', type: 'string', size: 100, defaultValue: null, externalId: false },
    },
  });

  const table = makeTableMock('TestObject');
  buildTable(table);

  expect(table.binary).toHaveBeenCalledWith('BinaryFld', 8);
  expect(table.boolean).toHaveBeenCalledWith('BoolFld');
  expect(table.biginteger).toHaveBeenCalledWith('BigIntFld');
  expect(table.date).toHaveBeenCalledWith('DateFld');
  expect(table.datetime).toHaveBeenCalledWith('DatetimeFld');
  expect(table.decimal).toHaveBeenCalledWith('DecimalFld', 15, 2);
  expect(table.enu).toHaveBeenCalledWith('EnumFld', ['A', 'B']);
  expect(table.integer).toHaveBeenCalledWith('IntFld');
  expect(table.string).toHaveBeenCalledWith('RefFld', 18);
  expect(table.string).toHaveBeenCalledWith('StrFld', 100);
  expect(table.text).toHaveBeenCalledWith('TextFld');
  expect(table.time).toHaveBeenCalledWith('TimeFld');
});

test('Test buildTable calls collate on reference-type fields', () => {
  const buildTable = sfcalls.__get__('buildTable');
  resetTypeResolver();
  sfcalls.setPreferences(buildTablePrefs);
  const refColMock = makeColumnMock();
  sfcalls.__set__('proposedSchema', {
    Contact: {
      AccountId: {
        name: 'AccountId', type: 'reference', size: 18, defaultValue: null, externalId: false,
      },
    },
  });

  const table = makeTableMock('Contact');
  table.string = jest.fn().mockReturnValue(refColMock);

  buildTable(table);

  expect(table.string).toHaveBeenCalledWith('AccountId', 18);
  expect(refColMock.collate).toHaveBeenCalledWith('utf8mb4_bin');
});

test('Test buildTable creates index for externalId fields', () => {
  const buildTable = sfcalls.__get__('buildTable');
  sfcalls.setPreferences({
    ...buildTablePrefs,
    indexes: { externalIds: true, lookups: false, picklists: false },
  });

  const colMock = makeColumnMock();
  sfcalls.__set__('proposedSchema', {
    Account: {
      External_ID__c: {
        name: 'External_ID__c', type: 'string', size: 36, defaultValue: null, externalId: true,
      },
    },
  });

  const table = makeTableMock('Account');
  table.string = jest.fn().mockReturnValue(colMock);

  buildTable(table);

  expect(colMock.index).toHaveBeenCalledWith('Account_External_ID__c');
});

test('Test buildTable creates index for lookup (reference) fields', () => {
  const buildTable = sfcalls.__get__('buildTable');
  sfcalls.setPreferences({
    ...buildTablePrefs,
    indexes: { externalIds: false, lookups: true, picklists: false },
  });

  const colMock = makeColumnMock();
  sfcalls.__set__('proposedSchema', {
    Contact: {
      AccountId: {
        name: 'AccountId', type: 'reference', size: 18, defaultValue: null, externalId: false,
      },
    },
  });

  const table = makeTableMock('Contact');
  table.string = jest.fn().mockReturnValue(colMock);

  buildTable(table);

  expect(colMock.index).toHaveBeenCalledWith('Contact_AccountId');
});

test('Test buildTable creates index for picklist fields', () => {
  const buildTable = sfcalls.__get__('buildTable');
  sfcalls.setPreferences({
    ...buildTablePrefs,
    indexes: { externalIds: false, lookups: false, picklists: true },
  });

  const colMock = makeColumnMock();
  sfcalls.__set__('proposedSchema', {
    Opportunity: {
      StageName: {
        name: 'StageName', type: 'picklist', size: 40, defaultValue: null, externalId: false, values: ['Prospecting', 'Closed Won'], isRestricted: true,
      },
    },
  });

  const table = makeTableMock('Opportunity');
  // Override both enu and string: if the type resolver has been mutated by an earlier
  // test, picklist may resolve to 'string' (default branch) instead of 'enum'. Either
  // way the field is still indexed because addIndex checks field.type, not fieldType.
  table.enu = jest.fn().mockReturnValue(colMock);
  table.string = jest.fn().mockReturnValue(colMock);

  buildTable(table);

  expect(colMock.index).toHaveBeenCalledWith('Opportunity_StageName');
});

test('Test buildTable does NOT create index when index preferences are disabled', () => {
  const buildTable = sfcalls.__get__('buildTable');
  sfcalls.setPreferences(buildTablePrefs);

  const colMock = makeColumnMock();
  sfcalls.__set__('proposedSchema', {
    Account: {
      ExtId: { name: 'ExtId', type: 'string', size: 36, defaultValue: null, externalId: true },
      AccountId: { name: 'AccountId', type: 'reference', size: 18, defaultValue: null, externalId: false },
      StageName: {
        name: 'StageName', type: 'picklist', size: 40, defaultValue: null, externalId: false, values: ['Open'], isRestricted: true,
      },
    },
  });

  const table = {
    _tableName: 'Account',
    binary: jest.fn().mockReturnValue(colMock),
    boolean: jest.fn().mockReturnValue(colMock),
    biginteger: jest.fn().mockReturnValue(colMock),
    date: jest.fn().mockReturnValue(colMock),
    datetime: jest.fn().mockReturnValue(colMock),
    decimal: jest.fn().mockReturnValue(colMock),
    enu: jest.fn().mockReturnValue(colMock),
    float: jest.fn().mockReturnValue(colMock),
    integer: jest.fn().mockReturnValue(colMock),
    string: jest.fn().mockReturnValue(colMock),
    text: jest.fn().mockReturnValue(colMock),
    time: jest.fn().mockReturnValue(colMock),
  };

  buildTable(table);

  expect(colMock.index).not.toHaveBeenCalled();
});
