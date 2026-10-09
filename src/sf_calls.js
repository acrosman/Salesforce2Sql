const fs = require('fs');
const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron');
const jsforce = require('jsforce');
const knex = require('knex');
const oauth = require('./sf_oauth');
const constants = require('./constants');

// Get the dialog library from Electron
const { dialog } = electron;

let activeConnection = null;
let mainWindow = null;
let proposedSchema = {};
let preferences = null;

// Import constants
const {
  typeResolverBases,
  standardObjectsByFeature,
  indicatorObjects,
  indicatorNamespaces,
  auditFields,
} = constants;

/**
 * Sets the window being used for the interface. Responses are sent to this window.
 * @param {*} window The ElectronJS window in use.
 */
const setwindow = (window) => {
  mainWindow = window;
};

/**
 * Sets the preferences for use in generating the schema.
 * @param {*} prefs The current application preference object to use.
 */
const setPreferences = (prefs) => {
  preferences = prefs;
};

/**
 * Builds a copy of a login request that is safe to send back to the interface.
 * @param {*} request The login request details.
 * @returns A copy of the request with secrets masked.
 */
const buildMaskedRequest = (request = {}) => ({
  // DEPRECATED(password-login): remove when #290 is done. Default to 'oauth' and
  // drop the username, password, and token fields.
  mode: request.mode || 'password',
  username: request.username || '',
  password: '********',
  token: '********',
  url: request.url || '',
});

/**
 * Stores the details needed to rebuild the active Salesforce connection.
 * @param {*} conn The authenticated jsforce connection.
 * @param {*} userInfo Details about the logged in user.
 * @param {*} options Login mode, login URL, and OAuth client config (OAuth only).
 * @returns The stored connection details.
 */
const setActiveSalesforceConnection = (conn, userInfo = {}, options = {}) => {
  activeConnection = {
    mode: options.mode || 'oauth',
    loginUrl: options.loginUrl,
    instanceUrl: conn.instanceUrl,
    accessToken: conn.accessToken,
    refreshToken: options.oauth2Config ? conn.refreshToken : undefined,
    oauth2Config: options.oauth2Config,
    version: '63.0',
    userInfo,
  };
  return activeConnection;
};

/**
 * Builds a jsforce connection from the stored active connection. OAuth sessions
 * include the refresh token so jsforce can renew an expired access token.
 * @returns A jsforce connection, or null when not logged in.
 */
const getActiveSalesforceConnection = () => {
  if (!activeConnection) {
    return null;
  }

  const connConfig = {
    loginUrl: activeConnection.loginUrl,
    instanceUrl: activeConnection.instanceUrl,
    accessToken: activeConnection.accessToken,
    version: activeConnection.version,
  };

  // jsforce rejects a refresh token without OAuth client details.
  if (activeConnection.oauth2Config && activeConnection.refreshToken) {
    connConfig.oauth2 = activeConnection.oauth2Config;
    connConfig.refreshToken = activeConnection.refreshToken;
  }

  const conn = new jsforce.Connection(connConfig);

  // Keep the stored token current so later connections use the new one.
  const stored = activeConnection;
  conn.on('refresh', (newAccessToken) => {
    stored.accessToken = newAccessToken;
  });

  return conn;
};

/**
 * Determines to SQL data type to use for a given SF field type.
 * @param {*} sfTypeName The SF field type.
 * @returns Returns the name of the sql column type to use.
 */
const resolveFieldType = (sfTypeName) => {
  const typeResolver = typeResolverBases;

  // Tweak for picklists when set to be strings.
  if (preferences.picklists.type !== 'enum') {
    typeResolver.picklist = 'string';
  }

  // Set Ids to be full strings instead of char(18) as needed.
  if (preferences.lookups.type !== 'char(18)') {
    typeResolver.reference = 'string';
  }

  if (Object.prototype.hasOwnProperty.call(typeResolver, sfTypeName)) {
    return typeResolver[sfTypeName];
  }

  return 'text';
};

/**
 * Send a log message to the console window.
 * @param {String} title  Message title or sender
 * @param {String} channel  Message category
 * @param {String} message  Message
 * @returns True (always).
 */
const logMessage = (title, channel, message) => {
  mainWindow.webContents.send('log_message', {
    sender: title,
    channel,
    message,
  });
  return true;
};

/**
 * Updates the loader message in the interface.
 * @param {String} message
 */
const updateLoader = (message) => {
  mainWindow.webContents.send('update_loader', { message });
};

/**
 * Extracts the list of field values from a picklist value set. Values are kept
 * raw; they are escaped for the target database when the DDL is built.
 * @param {Array} valueList list of values from a Salesforce describe response.
 * @returns the actual list of de-duplicated values.
 */
const extractPicklistValues = (valueList) => [...new Set(valueList.map((item) => item.value))];

/**
 * Generates the details of all the fields in the schema.
 * @param {*} fieldList An array of fields.
 * @param {*} allText Indicates if all strings should be text instead of varchar.
 * @returns an object with all of a table's fields and their details.
 */
const buildFields = (fieldList, allText = false) => {
  let fld;
  const objFields = {};
  let isReadOnly = false;
  let isAudit = false;

  for (let f = 0; f < fieldList.length; f += 1) {
    // Determine if this is a readonly or audit field.
    isReadOnly = fieldList[f].calculated || (!fieldList[f].updateable && !fieldList[f].createable);
    isAudit = auditFields.includes(fieldList[f].name);

    // Add field to schema if it's an Id, and allowed by preferences.
    if (fieldList[f].type === 'id'
      || (
        !(preferences.defaults.suppressReadOnly && isReadOnly)
        && !(preferences.defaults.suppressAudit && isAudit)
      )
    ) {
      fld = {};
      // Values we want for all fields.
      fld.name = fieldList[f].name;
      fld.label = fieldList[f].label;
      fld.type = fieldList[f].type;
      fld.size = fieldList[f].length;
      fld.defaultValue = fieldList[f].defaultValue;
      fld.externalId = fieldList[f].externalId;

      // Large text fields go to TEXT.
      if (fld.type === 'string' && (fld.size > 255 || allText)) {
        fld.type = 'text';
      }

      // Type specific values.
      switch (fld.type) {
        case 'reference':
          fld.target = fieldList[f].referenceTo;
          break;
        case 'picklist':
          fld.values = extractPicklistValues(fieldList[f].picklistValues);
          fld.isRestricted = fieldList[f].restrictedPicklist;
          break;
        case 'currency':
        case 'double':
        case 'float':
          fld.scale = fieldList[f].scale;
          fld.precision = fieldList[f].precision;
          break;
        default:
          break;
      }
      objFields[fld.name] = fld;
    }
  }
  return objFields;
};

// Field types a loaded schema may use: the Salesforce types, plus the types
// buildFields and buildDatabase substitute for long strings.
const validSchemaTypes = [...Object.keys(typeResolverBases), 'text'];

// Inclusive upper bounds for the numeric properties of a loaded schema field.
const maxSchemaFieldSize = 2147483647;
const maxSchemaFieldPrecision = 65;
const maxSchemaFieldScale = 30;

// The number of schema validation errors to show before summarizing the rest.
const maxReportedSchemaErrors = 5;

/**
 * Checks if a value is a plain object, as opposed to an array, null, or a primitive.
 * @param {*} value the value to check.
 * @returns {Boolean} true when the value is a plain object.
 */
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Checks if a value is an array that contains only strings.
 * @param {*} value the value to check.
 * @returns {Boolean} true when the value is an array of strings.
 */
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Checks if a value is an integer from 0 to a maximum, inclusive.
 * @param {*} value the value to check.
 * @param {Number} max the largest allowed value.
 * @returns {Boolean} true when the value is an integer in range.
 */
const isIntegerInRange = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Validates a single field of a loaded schema.
 * @param {String} tableName the name of the table the field belongs to.
 * @param {String} key the key the field is stored under.
 * @param {*} field the field details to validate.
 * @returns {Array} a list of error messages, empty when the field is valid.
 */
const validateSchemaField = (tableName, key, field) => {
  const where = `${tableName}.${key}`;
  if (!isPlainObject(field)) {
    return [`${where}: field must be an object.`];
  }

  const errors = [];
  if (typeof field.name !== 'string' || field.name === '' || field.name !== key) {
    errors.push(`${where}: name must be a string matching its key.`);
  }
  if (!validSchemaTypes.includes(field.type)) {
    errors.push(`${where}: type ${JSON.stringify(field.type)} is not a known field type.`);
  }

  if (Object.prototype.hasOwnProperty.call(field, 'size') && !isIntegerInRange(field.size, maxSchemaFieldSize)) {
    errors.push(`${where}: size must be an integer from 0 to ${maxSchemaFieldSize}.`);
  }
  if (Object.prototype.hasOwnProperty.call(field, 'precision') && !isIntegerInRange(field.precision, maxSchemaFieldPrecision)) {
    errors.push(`${where}: precision must be an integer from 0 to ${maxSchemaFieldPrecision}.`);
  }
  if (Object.prototype.hasOwnProperty.call(field, 'scale') && !isIntegerInRange(field.scale, maxSchemaFieldScale)) {
    errors.push(`${where}: scale must be an integer from 0 to ${maxSchemaFieldScale}.`);
  }

  if (Object.prototype.hasOwnProperty.call(field, 'values') && !isStringArray(field.values)) {
    errors.push(`${where}: values must be an array of strings.`);
  }
  if (field.type === 'picklist' && !Object.prototype.hasOwnProperty.call(field, 'values')) {
    errors.push(`${where}: picklist fields must have values.`);
  }

  if (Object.prototype.hasOwnProperty.call(field, 'defaultValue')) {
    const { defaultValue } = field;
    if (defaultValue !== null && !['string', 'number', 'boolean'].includes(typeof defaultValue)) {
      errors.push(`${where}: defaultValue must be a string, number, boolean, or null.`);
    }
  }

  ['externalId', 'isRestricted'].forEach((prop) => {
    if (Object.prototype.hasOwnProperty.call(field, prop) && typeof field[prop] !== 'boolean') {
      errors.push(`${where}: ${prop} must be a boolean.`);
    }
  });

  if (Object.prototype.hasOwnProperty.call(field, 'label') && typeof field.label !== 'string') {
    errors.push(`${where}: label must be a string.`);
  }
  if (Object.prototype.hasOwnProperty.call(field, 'target') && !isStringArray(field.target)) {
    errors.push(`${where}: target must be an array of strings.`);
  }

  return errors;
};

/**
 * Validates a schema loaded from a file before it is used to build a database.
 * @param {*} schema the parsed schema to validate.
 * @returns {Object} valid is true when the schema is usable; errors lists every problem found.
 */
const validateSchema = (schema) => {
  if (!isPlainObject(schema)) {
    return { valid: false, errors: ['Schema must be an object of tables.'] };
  }

  const errors = [];
  Object.keys(schema).forEach((tableName) => {
    const fields = schema[tableName];
    if (tableName === '') {
      errors.push('Table names must not be empty.');
    }
    if (!isPlainObject(fields)) {
      errors.push(`${tableName}: table must be an object of fields.`);
      return;
    }
    Object.keys(fields).forEach((key) => {
      errors.push(...validateSchemaField(tableName, key, fields[key]));
    });
  });

  return { valid: errors.length === 0, errors };
};

/**
 * Opens a dialog and starts the schema load process with the result.
 */
const loadSchemaFromFile = () => {
  const dialogOptions = {
    title: 'Load Schema',
    message: 'Load schema from JSON previously saved by Salesforce2Sql',
    filters: [
      { name: 'JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  };

  dialog.showOpenDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    const fileName = response.filePaths[0];

    fs.readFile(fileName, (err, data) => {
      if (err) {
        logMessage('File', 'Error', `Unable to load requested file: ${err.message}`);
        return;
      }

      let loadedSchema;
      try {
        loadedSchema = JSON.parse(data);
      } catch (parseErr) {
        logMessage('File', 'Error', `Unable to parse schema file: ${parseErr.message}`);
        return;
      }

      // Reject files that would crash or misbuild the database, keeping the current schema.
      const { valid, errors } = validateSchema(loadedSchema);
      if (!valid) {
        const shown = errors.slice(0, maxReportedSchemaErrors);
        const hidden = errors.length - shown.length;
        const more = hidden > 0 ? `\n...and ${hidden} more.` : '';
        logMessage('File', 'Error', `Schema file ${fileName} is not a valid schema:\n${shown.join('\n')}${more}`);
        return;
      }

      proposedSchema = loadedSchema;
      logMessage('File', 'Info', `Loaded schema from file: ${fileName}`);

      // Send Schema to interface for review.
      mainWindow.webContents.send('response_schema', {
        status: false,
        message: `Loaded schema from ${fileName}`,
        response: {
          schema: proposedSchema,
        },
      });
    });
  }).catch((err) => {
    logMessage('File', 'Error', `Unable to open schema file: ${err.message}`);
  });
};

/**
 * Adds a column restricted to a list of values, escaping each value for the
 * database dialect in use. Knex's enu() quotes values without escaping them,
 * so it must not be used with picklist values.
 * @param {object} table the table builder to add the column to.
 * @param {*} db the knex instance the table is built with.
 * @param {String} name the column name.
 * @param {Array} values the raw, unescaped list of allowed values.
 * @returns the new column builder.
 */
const addRestrictedValueColumn = (table, db, name, values) => {
  // An empty value list is not valid SQL, so allow only a blank value.
  const allowed = values.length ? values : [''];
  if (db.client.dialect === 'mysql') {
    const literals = allowed.map((value) => db.raw('?', [value]).toQuery());
    return table.specificType(name, `enum(${literals.join(', ')})`);
  }
  // checkIn() escapes through the client's own literal escaper.
  return table.text(name).checkIn(allowed);
};

/**
 * A callback to build out tables.
 * @param {object} table the table we're building out.
 * @param {*} db the knex instance the table is built with, used to escape values.
 */
const buildTable = (table, db) => {
  const fields = proposedSchema[table._tableName];
  let field;
  let fieldType;
  let addIndex;
  const fieldNames = Object.getOwnPropertyNames(fields);

  for (let i = 0; i < fieldNames.length; i += 1) {
    field = fields[fieldNames[i]];
    // Determine if the field should be indexed.
    addIndex = (preferences.indexes.lookups && (field.type === 'reference' || field.type === 'id'))
      || (preferences.indexes.picklists && field.type === 'picklist')
      || (preferences.indexes.externalIds && field.externalId);

    // Resolve SF type to DB type.
    fieldType = resolveFieldType(field.type);

    // Extract field size.
    let { size, defaultValue } = field;

    // If this is an unrestricted picklist.
    if (field.type === 'picklist' && !field.isRestricted && preferences.picklists.unrestricted) {
      fieldType = 'string';
      size = 255;
    }

    // Setup default when suggested.
    const stringTypes = ['string', 'text'];
    if (preferences.defaults.textEmptyString && stringTypes.includes(fieldType)) {
      if (defaultValue === 'null' || defaultValue === null) {
        defaultValue = '';
      }
    }

    // For checkbox fields, set a default of false instead of null when pref set.
    if (preferences.defaults.checkboxDefault && fieldType === 'boolean') {
      if (defaultValue === 'null' || defaultValue === null) {
        defaultValue = false;
      }
    }

    let column;
    switch (fieldType) {
      case 'binary':
        column = table.binary(field.name, size);
        break;
      case 'boolean':
        column = table.boolean(field.name);
        break;
      case 'biginteger':
        column = table.biginteger(field.name);
        break;
      case 'date':
        column = table.date(field.name);
        break;
      case 'datetime':
        column = table.datetime(field.name);
        break;
      case 'decimal':
        column = table.decimal(field.name, field.precision, field.scale);
        break;
      case 'enum':
        // Add a blank if needed.
        if (preferences.picklists.ensureBlanks && !field.values.includes('')) {
          field.values.push('');
        }
        column = addRestrictedValueColumn(table, db, field.name, field.values);
        break;
      case 'float':
        column = table.float(field.name, field.precision, field.scale);
        break;
      case 'integer':
        column = table.integer(field.name);
        break;
      case 'reference':
        column = table.string(field.name, 18);
        // Only impacts MySQL makes the collation case sensitive.
        column.collate('utf8mb4_bin');
        break;
      case 'text':
        column = table.text(field.name);
        break;
      case 'time':
        column = table.time(field.name);
        break;
      default:
        if (!size) {
          size = 255;
        }
        column = table.string(field.name, size);
    }

    if (preferences.defaults.attemptSFValues) {
      column.defaultTo(defaultValue);
    }

    if (addIndex) {
      // To avoid prefixing with table name (which can easily violate the length
      // limit from MySQL and Postgres), use the field name as the column name
      // which should top out around the same places as the limit (60) unless a
      // _really_ long package namespace is in play. However, on Sqlite you need
      // a totally unique name (which is what knex does by default but assumes
      // unlimited length).
      let name = `${table._tableName}_${field.name}`;
      if (name.length > 60) {
        name = field.name + Math.round((Math.random() * 99999) + 10000);
      }
      column.index(name);
    }
  }
};

/**
 * Reviews an org's list of objects to guess the org type. Returns a list of enabled features
 * and packages (supported by this process) to help identify what's in this org.
 * @param {Object} sObjectList The list of objects for the org.
 * @returns {Array} org feature list.
 */
const sniffOrgType = (sObjectList) => {
  // List of features found.
  const features = [];

  const namespaceKeys = Object.getOwnPropertyNames(indicatorNamespaces);
  const objectKeys = Object.getOwnPropertyNames(indicatorObjects);
  for (let i = 0; i < sObjectList.length; i += 1) {
    // Check namespace-based indicators
    for (let j = 0; j < namespaceKeys.length; j += 1) {
      if (sObjectList[i].name.startsWith(namespaceKeys[j])) {
        const feature = indicatorNamespaces[namespaceKeys[j]];
        if (!features.includes(feature)) {
          features.push(feature);
        }
      }
    }

    // Check indicator objects.
    if (objectKeys.includes(sObjectList[i].name)) {
      const featureList = indicatorObjects[sObjectList[i].name];
      featureList.forEach((feature) => {
        if (!features.includes(feature)) {
          features.push(feature);
        }
      });
    }
  }

  // If no features were detected, assume this is a Sales org
  if (features.length === 0) {
    features.push('sales');
  }

  return features;
};

/**
 * Review previously loaded object list and send to the Render thread a recommended
 * list of objects to select.
 * @param {Array} objectResult The list of objects from a global describe of the org.
 * @returns an array of object name to default select.
 */
const recommendObjects = (objectResult) => {
  const featureList = sniffOrgType(objectResult);
  const recommended = new Set();

  // Add standard objects for each detected feature
  featureList.forEach((feature) => {
    if (standardObjectsByFeature[feature]) {
      standardObjectsByFeature[feature].forEach((obj) => {
        recommended.add(obj);
      });
    }
  });

  // Add all custom objects found in the org
  objectResult.forEach((obj) => {
    if (obj.name.endsWith('__c')) {
      recommended.add(obj.name);
    }
  });

  // Convert Set to array
  const recommendedList = [...recommended];

  return recommendedList;
};

/**
 * Open a save dialogue and write settings to a file.
 */
const saveSchemaToFile = () => {
  const dialogOptions = {
    title: 'Save Schema To',
    message: 'Create File',
  };

  dialog.showSaveDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    let fileName = response.filePath;

    if (path.extname(fileName).toLowerCase() !== '.json') {
      fileName = `${fileName}.json`;
    }

    fs.writeFile(fileName, JSON.stringify(proposedSchema), (err) => {
      if (err) {
        logMessage('Save', 'Error', `Unable to save file: ${err}`);
      } else {
        logMessage('Save', 'Info', `Schema saved to ${fileName}`);
      }
    });
  }).catch((err) => {
    logMessage('Save', 'Error', `Saved failed after dialog: ${err}`);
  });
};

/**
 * Open a save dialogue and select file target for Sqlite3 file.
 */
const saveSqlite3File = () => {
  const dialogOptions = {
    title: 'Select Sqlite3 Database Location',
    message: 'Create File',
  };

  dialog.showSaveDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    let fileName = response.filePath;
    const extension = path.extname(fileName).toLowerCase();
    if (extension !== '.sqlite' && extension !== '.db' && extension !== '.sqlite3') {
      fileName = `${fileName}.sqlite`;
    }

    mainWindow.webContents.send('response_sqlite3_file', {
      status: false,
      message: 'Sqlite3 File Selected',
      response: {
        filePath: fileName,
      },
    });
  }).catch((err) => {
    logMessage('Save', 'Error', `Saved failed after dialog: ${err}`);
  });
};

/**
 * Create a database connection using the knex library.
 * @param {*} settings An object with database connections settings.
 * @returns the database connection object.
 */
const createKnexConnection = (settings) => {
  // Create database connection.
  const db = knex({
    client: settings.type,
    connection: {
      host: settings.host,
      user: settings.username,
      password: settings.password,
      database: settings.dbname,
      port: settings.port,
      filename: settings.fileName,
    },
    acquireConnectionTimeout: settings.timeout,
    useNullAsDefault: true,
    pool: {
      min: 0,
      max: settings.pool,
    },
    log: {
      warn(message) {
        logMessage('Knex', 'Warn', message);
      },
      error(message) {
        logMessage('Knex', 'Error', message);
      },
      deprecate(message) {
        logMessage('Knex', 'Deprecated', message);
      },
      debug(message) {
        logMessage('Knex', 'Debug', message);
      },
    },
  });

  return db;
};

/**
 * Tests if we have a valid connection to the database.
 * @param {*} knexDb connection to test.
 * @returns boolean
 * @throws Exception if connection fails.
 */
const validateConnection = (knexDb) => knexDb.raw('SELECT 1 AS isUp');

/**
 * Save the current database schema to an SQL file.
 * @param {*} settings Current database connection settings.
 */
const saveSchemaToSql = (settings) => {
  const db = createKnexConnection(settings);
  const tables = Object.getOwnPropertyNames(proposedSchema);

  // Simple callback used to generate the DDL statements.
  const createDbTable = (schema, table) => schema
    .createTable(table, (tableBuilder) => buildTable(tableBuilder, db))
    .generateDdlCommands();

  const dialogOptions = {
    title: 'Save SQL File',
    message: 'Create File',
  };
  dialog.showSaveDialog(mainWindow, dialogOptions).then((response) => {
    let fileName = response.filePath;

    if (path.extname(fileName).toLowerCase() !== '.sql') {
      fileName = `${fileName}.sql`;
    }

    const writeStream = fs.createWriteStream(fileName);
    writeStream.on('error', (err) => {
      logMessage('SQL File', 'Error', `Error saving to file ${err}`);
    });
    for (let i = 0; i < tables.length; i += 1) {
      createDbTable(db.schema, tables[i]).then((result) => {
        logMessage('Schema Save', 'Info', `Created DDL statements for ${tables[i]}`);
        writeStream.write(`${result.sql[0].sql};\n`);
      });
    }
  });
};

/**
 * Builds the actual database from generated schema.
 * @param {*} settings Database connection settings.
 */
const buildDatabase = (settings) => {
  // Get the collection of tables we're about to create.
  const tables = Object.getOwnPropertyNames(proposedSchema);

  // Set the connection pool size to be as large as number of tables.
  settings.pool = tables.length;
  // Setup Database Connection
  const db = createKnexConnection(settings);

  // Helper to keep one line of logic for creating the tables.
  const tableStatuses = {};
  const createDbTable = (schema, table) => schema
    .createTable(table, (tableBuilder) => buildTable(tableBuilder, db))
    .then(() => {
      tableStatuses[table] = true;
      if (Object.getOwnPropertyNames(tableStatuses).length === tables.length) {
        mainWindow.webContents.send('response_db_generated', {
          status: true,
          message: 'Database created',
          responses: tableStatuses,
        });
      } else {
        updateLoader(`Creating ${tables.length} tables, ${Object.getOwnPropertyNames(tableStatuses).length} complete`);
      }
    })
    .catch((err) => {
      // If the row is too big, replace all varchar (except ref fields) with text and try again.
      if (err.code === 'ER_TOO_BIG_ROWSIZE') {
        let changed = false;
        const tableFields = Object.getOwnPropertyNames(proposedSchema[table]);
        for (let i = 0; i < tableFields.length; i += 1) {
          if (resolveFieldType(proposedSchema[table][tableFields[i]].type) === 'string') {
            proposedSchema[table][tableFields[i]].type = 'text';
            changed = true;
          }
        }
        // If we updated the schema, try again.
        if (changed) {
          logMessage('Database Create', 'Warning', `Proposed ${table} schema had too many string fields for your database. All strings will be text fields instead.`);
          createDbTable(schema, table);
        } else {
          logMessage('Database Create', 'Error', `Unable to create table: ${table}. There are too many columns for the database engine even after converting all text fields to use text storage. \nError ${err.errno}(${err.code}) creating table: ${err.message}. Full statement:\n ${err.sql}`);
          tableStatuses[table] = false;
          updateLoader(`Creating ${tables.length} tables, ${Object.getOwnPropertyNames(tableStatuses).length} complete`);
        }
      } else if (err.code === 'ER_TOO_MANY_KEYS') {
        logMessage('Database Create', 'Warning', `Error ${err.errno}(${err.code}) adding keys to ${table}. Table was created but some desired indexes may be missing.`);
        tableStatuses[table] = true;
        updateLoader(`Creating ${tables.length} tables, ${Object.getOwnPropertyNames(tableStatuses).length} complete`);
      } else {
        logMessage('Database Create', 'Error', `Error ${err.errno}(${err.code}) creating table: ${err.message}.Full statement: \n ${err.sql}`);
        tableStatuses[table] = false;
        updateLoader(`Creating ${tables.length} tables, ${Object.getOwnPropertyNames(tableStatuses).length} complete`);
      }
      if (Object.getOwnPropertyNames(tableStatuses).length === tables.length) {
        mainWindow.webContents.send('response_db_generated', {
          status: true,
          message: 'Database created',
          responses: tableStatuses,
        });
      }
      return err;
    });

  // If we have a valid connection, let's give this a try
  validateConnection(db).then(() => {
    updateLoader(`Creating ${tables.length} tables`);

    const dropCallback = (tableName, err) => {
      if (err) {
        logMessage('Database', 'Error', `Error dropping existing table ${err}`);
      } else {
        updateLoader(`Creating ${tables.length} tables: deleted ${tableName}`);
        createDbTable(db.schema, tableName);
      }
    };

    for (let i = 0; i < tables.length; i += 1) {
      if (settings.overwrite) {
        db.schema.dropTableIfExists(tables[i])
          .asCallback((err) => { dropCallback(tables[i], err); });
      } else {
        createDbTable(db.schema, tables[i]);
      }
    }
  }).catch((err) => {
    logMessage('Database', 'Error', `Error connecting to database: ${err}`);
    mainWindow.webContents.send('response_db_generated', {
      status: false,
      message: `Database creation failed: ${err}`,
      responses: {},
    });
  });
};

/**
 * Sends the result of a login attempt to the interface.
 * @param {*} conn The jsforce connection, if one was created.
 * @param {boolean} status True on success.
 * @param {string} message Summary message.
 * @param {*} response User details on success, error text on failure.
 * @param {*} request The original login request (secrets are masked).
 */
const sendLoginResponse = (conn, status, message, response, request) => {
  mainWindow.webContents.send('response_login', {
    status,
    message,
    response,
    limitInfo: conn?.limitInfo || {},
    request: buildMaskedRequest(request),
  });
};

/**
 * Records a successful login and notifies the interface.
 * @param {*} conn The authenticated jsforce connection.
 * @param {*} userInfo User details returned by the login.
 * @param {*} request The original login request.
 * @param {string} context Title used for log messages.
 * @param {*} oauth2Config OAuth client config, so the session can be refreshed.
 */
const handleLoginSuccess = (conn, userInfo, request, context, oauth2Config) => {
  const response = {
    ...userInfo,
    organizationId: userInfo.organizationId || userInfo.organization_id || '',
    // DEPRECATED(password-login): remove when #290 is done. Drop the
    // request.username fallback, since OAuth gets the username from identity().
    username: request.username || userInfo.username || userInfo.preferred_username || userInfo.id || 'OAuth2',
  };

  logMessage(
    context,
    'Info',
    `Connection Org ${response.organizationId || 'Unknown'} for User ${response.username}`,
  );
  setActiveSalesforceConnection(conn, response, {
    mode: request.mode,
    loginUrl: request.url,
    oauth2Config,
  });
  sendLoginResponse(conn, true, 'Login Successful', response, request);
};

/**
 * Notifies the interface that a login attempt failed.
 * @param {*} err The error raised by the login.
 * @param {*} conn The jsforce connection, if one was created.
 * @param {*} request The original login request.
 */
const handleLoginFailure = (err, conn, request) => {
  // DEPRECATED(password-login): remove when #290 is done. The request shape
  // (username, password, token) can shrink to mode and url.
  sendLoginResponse(conn, false, 'Login Failed', err.message || `${err}`, request);
};

/**
 * Login with username, password, and security token via the SOAP API.
 * DEPRECATED(password-login): remove this function when #290 is done.
 * @param {string} url The login URL.
 * @param {string} username Salesforce username.
 * @param {string} password Password with the security token appended.
 * @returns A promise that settles after the interface is notified.
 */
const sfPasswordLogin = (url, username, password) => {
  const conn = new jsforce.Connection({
    loginUrl: url,
  });

  return conn.login(username, password).then(
    (userInfo) => {
      handleLoginSuccess(conn, userInfo, {
        mode: 'password',
        username,
        url,
      }, 'Password Login Attempt');
    },
    (err) => {
      handleLoginFailure(err, conn, {
        mode: 'password',
        username,
        url,
      });
    },
  );
};

/**
 * Login using the OAuth web server flow in the user's browser.
 * @param {string} url The login URL (login, test, or My Domain for SSO).
 * @returns A promise that settles after the interface is notified.
 */
const sfOAuthLogin = (url) => oauth.attemptLogin(url).then(
  ({ conn, userInfo, oauth2Config }) => {
    handleLoginSuccess(conn, userInfo, {
      mode: 'oauth',
      url,
    }, 'OAuth Login Attempt', oauth2Config);
  },
  (err) => {
    handleLoginFailure(err, null, {
      mode: 'oauth',
      url,
      username: 'OAuth2',
    });
  },
);

/**
 * List of remote call handlers for using with IPC.
 */
const handlers = {
  /**
   * Login to an org.
   * @param {*} event Standard message event.
   * @param {*} args Login credentials from the interface.
   */
  sf_login: (event, args) => {
    if (args.mode === 'oauth') {
      return sfOAuthLogin(args.url);
    }

    // DEPRECATED(password-login): remove this branch, including token handling
    // and the deprecation warning, when #290 is done.
    // Only the token is trimmed. Passwords are used exactly as entered.
    let password = args.password || '';
    if (args.token && args.token.trim()) {
      password = `${password}${args.token.trim()}`;
    }
    logMessage(
      event.sender.getTitle(),
      'Warn',
      'Username/Password login is deprecated and will be removed in a future version. Please switch to OAuth.',
    );
    return sfPasswordLogin(args.url, args.username, password);
  },
  /**
   * Logout of a specific Salesforce org.
   * @param {*} event Standard message event.
   * @param {*} args The connection to disable.
   */
  sf_logout: (event, args) => {
    const conn = getActiveSalesforceConnection();

    if (!conn) {
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: 'No active Salesforce connection.',
        limitInfo: {},
        request: args,
      });
      return;
    }

    const fail = (err) => {
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: `${err} `,
        limitInfo: conn.limitInfo,
        request: args,
      });
      logMessage(event.sender.getTitle(), 'Error', `Logout Failed ${err} `);
    };
    const success = () => {
      // now the session has been expired.
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      activeConnection = null;
    };
    // For OAuth, revoke the refresh token (which also ends the access token).
    const revoke = Boolean(activeConnection.oauth2Config);
    const logoutAction = typeof conn.logout === 'function' ? conn.logout(revoke) : conn.logout;
    Promise.resolve(logoutAction).then(success).catch(fail);
  },
  /**
   * Run a global describe.
   * @param {*} event Standard message event.
   * @param {*} args Message args with org to use.
   * @returns True.
   */
  sf_describeGlobal: (event, args) => {
    const conn = getActiveSalesforceConnection();

    if (!conn) {
      mainWindow.webContents.send('response_error', {
        status: false,
        message: 'Describe Global Failed',
        response: 'No active Salesforce connection.',
        limitInfo: {},
        request: args,
      });
      return true;
    }

    const fail = (err) => {
      mainWindow.webContents.send('response_error', {
        status: false,
        message: 'Describe Global Failed',
        response: `${err} `,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return false;
    };
    const success = (result) => {
      // Send records back to the interface.
      logMessage('Fetch Objects', 'Info', `Used global describe to list ${result.sobjects.length} SObjects.`);
      result.recommended = recommendObjects(result.sobjects);
      mainWindow.webContents.send('response_list_objects', {
        status: true,
        message: 'Describe Global Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    };

    return conn.describeGlobal().then(success, fail);
  },
  /**
   * Get a list of all fields on a provided list of objects.
   * @param {*} event Standard message event.
   * @param {*} args Arguments from the interface.
   * @returns True.
   */
  sf_getObjectFields: (event, args) => {
    const conn = getActiveSalesforceConnection();
    let completedObjects = 0;
    const allObjects = {};

    if (!conn) {
      mainWindow.webContents.send('response_error', {
        status: false,
        message: 'Field Fetch Failed',
        response: 'No active Salesforce connection.',
        limitInfo: {},
        request: args,
      });
      return true;
    }

    // Reset the proposed schema back to baseline.
    proposedSchema = {};

    // Log status
    logMessage('Schema', 'Info', `Fetching schema for ${args.objects.length} objects`);
    updateLoader(`Loaded ${completedObjects} of ${args.objects.length} Object Describes`);

    args.objects.forEach((obj) => {
      if (obj !== undefined) {
        conn.sobject(obj).describe().then((response) => {
          completedObjects += 1;
          proposedSchema[response.name] = buildFields(response.fields);
          updateLoader(`Loaded ${completedObjects} of ${args.objects.length} Object Describes`);
          allObjects[response.name] = response;
          if (completedObjects === args.objects.length) {
            // Send Schema to interface for review.
            mainWindow.webContents.send('response_schema', {
              status: false,
              message: 'Processed Objects',
              response: {
                objects: allObjects,
                schema: proposedSchema,
              },
              limitInfo: conn.limitInfo,
              request: args,
            });
          }
        }, (err) => {
          logMessage('Field Fetch', 'Error', `Error loading describe for ${obj}: ${err} `);
        });
      }
    });
    return true;
  },
  /**
   * Connect to a database and set the schema.
   * @param {*} event Standard message event.
   * @param {*} args Connection settings.
   */
  knex_schema: (event, args) => {
    buildDatabase(args);
    logMessage('Database', 'Info', 'Database build started.');
  },
  /**
   * Send a log message to message console window.
   * @param {*} event Standard message event.
   * @param {*} args Log arguments.
   * @returns true.
   */
  log_message: (event, args) => {
    mainWindow.webContents.send('log_message', {
      sender: args.sender,
      channel: args.channel,
      message: args.message,
    });
    return true;
  },
  /**
   * Load a previously saved Schema from a file.
   */
  load_schema: () => {
    loadSchemaFromFile();
  },
  /**
   * Save the current schema settings to a file.
   */
  save_schema: () => {
    saveSchemaToFile();
  },
  /**
   * Save the current schema to a SQL file.
   */
  save_ddl_sql: (event, args) => {
    saveSchemaToSql(args);
  },
  /**
   * Select Sqlite3 file location.
   */
  select_sqlite3_location: () => {
    saveSqlite3File();
  },
};

// Export setup.
exports.handlers = handlers;
exports.setwindow = setwindow;
exports.setPreferences = setPreferences;
