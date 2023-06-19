const fs = require('fs');
const path = require('path');
const electron = require('electron'); // eslint-disable-line
const jsforce = require('jsforce');
const knex = require('knex');

// Get the dialog library from Electron
const { dialog } = electron;

const sfConnections = {};
let mainWindow = null;
let proposedSchema = {};
let preferences = null;

// Baseline for Type conversions between environments.
const typeResolverBases = {
  base64: 'text',
  boolean: 'boolean',
  byte: 'binary',
  calculated: 'string',
  comboBox: 'string',
  currency: 'decimal',
  date: 'date',
  datetime: 'datetime',
  double: 'decimal',
  email: 'string',
  encryptedstring: 'string',
  id: 'reference',
  int: 'integer',
  long: 'biginteger',
  masterrecord: 'string',
  multipicklist: 'string',
  percent: 'decimal',
  phone: 'string',
  picklist: 'enum',
  reference: 'reference',
  string: 'string',
  textarea: 'text',
  time: 'time',
  url: 'string',
};

// Different common packages beg for different sets of Standard objects as likely to be used.
const standardObjectsByNamespace = {
  npsp: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Opportunity',
    'OpportunityContactRole',
    'RecordType',
    'Task',
    'User',
  ],
  eda: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Lead',
    'RecordType',
    'Task',
    'User',
  ],
  other: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Lead',
    'Opportunity',
    'OpportunityContactRole',
    'Order',
    'OrderItem',
    'PriceBook2',
    'Product2',
    'RecordType',
    'Task',
    'User',
  ],
};

const auditFields = [
  'CreatedDate',
  'CreatedById',
  'LastModifiedDate',
  'LastModifiedById',
  'SystemModstamp',
  'LastActivityDate',
  'LastViewedDate',
  'LastReferencedDate',
];

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
 * Extracts the list of field values from a picklist value set.
 * @param {Array} valueList list of values from a Salesforce describe response.
 * @returns the actual list of values.
 */
const extractPicklistValues = (valueList) => {
  let values = [];
  let val;
  for (let i = 0; i < valueList.length; i += 1) {
    val = valueList[i].value;
    // When https://github.com/knex/knex/issues/4481 resolves, this may create a double escape.
    if (val.includes("'")) {
      // When Node 14 support is dropped this can be switched to replaceAll().
      val = val.replace(/'/g, '\\\'');
    }
    values.push(val);
  }
  values = [...new Set(values)];
  return values;
};

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

/**
 * Opens a dialog and starts the schema load process with the result.
 */
const loadSchemaFromFile = () => {
  const dialogOptions = {
    title: 'Load Schema',
    message: 'Load schema from JSON previously saved by Salesforce2Sql',
    filters: [
      { name: JSON, extensions: ['json'] },
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

      // @TODO: Validate that schema is in a useable form.

      proposedSchema = JSON.parse(data);
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
  });
};

/**
 * A callback to build out tables.
 * @param {object} table the table we're building out.
 */
const buildTable = (table) => {
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
        column = table.enu(field.name, field.values);
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
 * Reviews an org's list of objects to guess the org type
 * @param {Object} sObjectList The list of objects for the org.
 * @returns {String} org type. One of npsp, eda, other.
 */
const sniffOrgType = (sObjectList) => {
  const namespaces = {
    npsp: 'npsp',
    npe: 'npsp',
    hed: 'eda',
  };

  const keys = Object.getOwnPropertyNames(namespaces);
  for (let i = 0; i < sObjectList.length; i += 1) {
    for (let j = 0; j < keys.length; j += 1) {
      if (sObjectList[i].name.startsWith(keys[j])) {
        return namespaces[keys[j]];
      }
    }
  }
  return 'other';
};

/**
 * Review previously loaded object list and send to the Render thread a recommended
 * list of objects to select.
 * @param {Array} objectResult The list of objects from a global describe of the org.
 * @returns an array of object name to default select.
 */
const recommendObjects = (objectResult) => {
  const orgType = sniffOrgType(objectResult);
  const suggestedStandards = standardObjectsByNamespace[orgType];
  const recommended = [];
  objectResult.forEach((obj) => {
    if (suggestedStandards.includes(obj.name) || obj.name.endsWith('__c')) {
      recommended.push(obj.name);
    }
  });
  return recommended;
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
  const createDbTable = (schema, table) => schema.createTable(table, buildTable)
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
  const createDbTable = (schema, table) => schema.createTable(table, buildTable)
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
 * List of remote call handlers for using with IPC.
 */
const handlers = {
  /**
   * Login to an org using password authentication.
   * @param {*} event Standard message event.
   * @param {*} args Login credentials from the interface.
   */
  sf_login: (event, args) => {
    const conn = new jsforce.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: args.url,
    });

    let { password } = args;
    if (args.token !== '') {
      password = `${password}${args.token}`;
    }

    conn.login(args.username, password).then(
      (userInfo) => {
        // Since we send the args back to the interface, it's a good idea
        // to remove the security information.
        args.password = '';
        args.token = '';

        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        logMessage(event.sender.getTitle(), 'Info', `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`);

        // Save the next connection in the global storage.
        sfConnections[userInfo.organizationId] = {
          instanceUrl: conn.instanceUrl,
          accessToken: conn.accessToken,
        };

        mainWindow.webContents.send('response_login', {
          status: true,
          message: 'Login Successful',
          response: userInfo,
          limitInfo: conn.limitInfo,
          request: args,
        });
      },
      (err) => {
        mainWindow.webContents.send('response_login', {
          status: false,
          message: 'Login Failed',
          response: err,
          limitInfo: conn.limitInfo,
          request: args,
        });
      },
    );
  },
  /**
   * Logout of a specific Salesforce org.
   * @param {*} event Standard message event.
   * @param {*} args The connection to disable.
   */
  sf_logout: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
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
      sfConnections[args.org] = null;
    };
    conn.logout.then(success, fail);
  },
  /**
   * Run a global describe.
   * @param {*} event Standard message event.
   * @param {*} args Message args with org to use.
   * @returns True.
   */
  sf_describeGlobal: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    const fail = (err) => {
      mainWindow.webContents.send('response_error', {
        status: false,
        message: 'Describe Global Failed',
        response: `${err} `,
        limitInfo: conn.limitInfo,
        request: args,
      });
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

    conn.describeGlobal.then(success, fail);
  },
  /**
   * Get a list of all fields on a provided list of objects.
   * @param {*} event Standard message event.
   * @param {*} args Arguments from the interface.
   * @returns True.
   */
  sf_getObjectFields: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    let completedObjects = 0;
    const allObjects = {};

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
