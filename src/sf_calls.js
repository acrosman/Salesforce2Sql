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

const setwindow = (window) => {
  mainWindow = window;
};

const resolveFieldType = (sfTypeName) => {
  const typeResolver = {
    base64: 'binary',
    boolean: 'boolean',
    byte: 'binary',
    calculated: 'string',
    comboBox: 'string',
    currency: 'decimal',
    date: 'date',
    datetime: 'datetime',
    double: 'float',
    email: 'string',
    encryptedstring: 'string',
    id: 'string',
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
 * Extracts the list of field values from a picklist value set.
 * @param {Array} valueList list of values from a Salesforce describe response.
 * @returns the actual list of values.
 */
const extractPicklistValues = (valueList) => {
  const values = [];
  for (let i = 0; i < valueList.length; i += 1) {
    values.push(valueList[i].value);
  }
  return values;
};

/**
 *
 * @param {Object} objectList Collection of sObject describes to convert to schema.
 * @returns An object we can convert easily into an SQL schema.
 */
const buildSchema = (objectList) => {
  const schema = {};

  // For each object we need to extract the field list, including their types.
  const objects = Object.getOwnPropertyNames(objectList);
  let objFields;
  let fld;
  let obj;
  for (let i = 0; i < objects.length; i += 1) {
    objFields = {};
    obj = objectList[objects[i]];
    for (let f = 0; f < obj.fields.length; f += 1) {
      fld = {};
      // Values we want for all fields.
      fld.name = obj.fields[f].name;
      fld.label = obj.fields[f].label;
      fld.type = obj.fields[f].type;
      fld.size = obj.fields[f].length;

      // Large text fields go to TEXT.
      if (fld.type === 'string' && fld.size > 255) {
        fld.type = 'text';
      }

      // Type specific values.
      switch (fld.type) {
        case 'reference':
          fld.target = obj.fields[f].referenceTo;
          break;
        case 'picklist':
          fld.values = extractPicklistValues(obj.fields[f].picklistValues);
          break;
        case 'float':
        case 'double':
          fld.scale = obj.fields[f].scale;
          fld.precision = obj.fields[f].precision;
          break;
        default:
          break;
      }
      objFields[fld.name] = fld;
    }
    schema[objects[i]] = objFields;
  }

  return schema;
};

const loadSchemaFromFile = () => {
  const dialogOptions = {
    title: 'Load Schema',
    message: 'Load schema from JSON previously saved by Salesforce2Sql',
    filters: [
      { name: JSON, extenions: ['json'] },
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

    if (path.extname(fileName).toLowerCase() !== 'json') {
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

const buildDatabase = (settings) => {
  // Create database connection.
  const db = knex({
    client: settings.type,
    connection: {
      host: settings.host,
      user: settings.username,
      password: settings.password,
      database: settings.dbname,
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

  const tables = Object.getOwnPropertyNames(proposedSchema);

  // define callback to build out tables.
  const buildTable = (table) => {
    const fields = proposedSchema[table._tableName];
    let field;
    let fieldType;
    const fieldNames = Object.getOwnPropertyNames(fields);

    for (let i = 0; i < fieldNames.length; i += 1) {
      field = fields[fieldNames[i]];
      fieldType = resolveFieldType(field.type);
      switch (fieldType) {
        case 'binary':
          table.binary(field.name, field.size);
          break;
        case 'boolean':
          table.boolean(field.name);
          break;
        case 'biginteger':
          table.biginteger(field.name);
          break;
        case 'date':
          table.date(field.name);
          break;
        case 'datetime':
          table.datetime(field.name);
          break;
        case 'decimal':
          table.decimal(field.name, field.precision, field.scale);
          break;
        case 'enum':
          table.enu(field.name, field.values);
          break;
        case 'float':
          table.float(field.name, field.precision, field.scale);
          break;
        case 'integer':
          table.integer(field.name);
          break;
        case 'reference':
          table.string(field.name, 18);
          break;
        case 'text':
          table.text(field.name);
          break;
        case 'time':
          table.time(field.name);
          break;
        default:
          table.string(field.name, field.size);
      }
    }

    logMessage('Database', 'Info', `Details of ${table._tableName} complete`);
  };

  // Helper to keep one line of logic for creating the tables.
  const createDbTable = (schema, table) => {
    schema.createTable(table, buildTable)
      .then(() => {
        logMessage('Database', 'Success', 'Successfully created new table');
      })
      .catch((err) => {
        logMessage('Database Create', 'Error', `Error creating table: ${err}`);
      });
  };

  for (let i = 0; i < tables.length; i += 1) {
    if (settings.overwrite) {
      db.schema.dropTableIfExists(tables[i])
        .then(() => { createDbTable(db.schema, tables[i]); })
        .catch((err) => {
          logMessage('Database Create', 'Error', `Failed to drop existing table ${tables[i]}: ${err}`);
        });
    } else {
      createDbTable(db.schema, tables[i]);
    }
  }
};

const handlers = {
  // Login to an org using password authentication.
  sf_login: (event, args) => {
    const conn = new jsforce.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: args.url,
    });

    let { password } = args;
    if (args.token !== '') {
      password = `${password}${args.token}`;
    }

    conn.login(args.username, password, (err, userInfo) => {
      // Since we send the args back to the interface, it's a good idea
      // to remove the security information.
      args.password = '';
      args.token = '';

      if (err) {
        mainWindow.webContents.send('sfShowOrgId', {
          status: false,
          message: 'Login Failed',
          response: err,
          limitInfo: conn.limitInfo,
          request: args,
        });
        return true;
      }
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
      return true;
    });
  },
  // Logout of a specific Salesforce org.
  sf_logout: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.logout((err) => {
      if (err) {
        mainWindow.webContents.send('response_logout', {
          status: false,
          message: 'Logout Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });
        logMessage(event.sender.getTitle(), 'Error', `Logout Failed ${err}`);
        return true;
      }
      // now the session has been expired.
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      sfConnections[args.org] = null;
      return true;
    });
  },
  // Run a Global Describe.
  sf_describeGlobal: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.describeGlobal((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Describe Global Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        logMessage('Fetch Objects', 'Error', `Describe Global Failed ${err}`);
        return true;
      }

      // Send records back to the interface.
      logMessage('Fetch Objects', 'Info', `Used global describe to list ${result.sobjects.length} SObjects.`);
      mainWindow.webContents.send('response_list_objects', {
        status: true,
        message: 'Describe Global Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Get a list of all fields on a provided list of objects.
  sf_getObjectFields: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    const describeCalls = [];
    const objectDescribes = {};

    // Create a collection of promises for the various objects.
    for (let i = 0; i < args.objects.length; i += 1) {
      describeCalls.push(conn.sobject(args.objects[i]).describe());
    }

    // Log status
    logMessage('Schema', 'Info', `Fetching schema for ${args.objects.length} objects`);

    // Wait for all of them to resolve, and build a collection.
    Promise.all(describeCalls).then((responses) => {
      for (let i = 0; i < responses.length; i += 1) {
        objectDescribes[responses[i].name] = responses[i];
      }

      // Build draft schema.
      proposedSchema = buildSchema(objectDescribes);

      // Send Schema to interface for review.
      mainWindow.webContents.send('response_schema', {
        status: false,
        message: 'Processed Objects',
        response: {
          objects: objectDescribes,
          schema: proposedSchema,
        },
        limitInfo: conn.limitInfo,
        request: args,
      });
    });
    return true;
  },
  // Connect to a database and set the schema.
  knex_schema: (event, args) => {
    buildDatabase(args);
    logMessage('Database', 'Info', 'Database build started.');
  },
  // Send a log message to the console window.
  log_message: (event, args) => {
    mainWindow.webContents.send('log_message', {
      sender: args.sender,
      channel: args.channel,
      message: args.message,
    });
    return true;
  },
  // Load a previously saved Schema from a file.
  load_schema: () => {
    loadSchemaFromFile();
  },
  // Save the current schema settings to a file.
  save_schema: () => {
    saveSchemaToFile();
  },
};

exports.handlers = handlers;
exports.setwindow = setwindow;
