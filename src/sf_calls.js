const jsforce = require('jsforce');

const sfConnections = {};
let mainWindow = null;
let consoleWindow = null;

const setwindow = (windowName, window) => {
  switch (windowName) {
    case 'console':
      consoleWindow = window;
      break;
    case 'main':
    default:
      mainWindow = window;
      break;
  }
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
const proposeSchema = (objectList) => {
  const schema = {};

  // For each object we need to extract the field list, including their types.
  const objects = Object.getOwnPropertyNames(objectList);
  let objFields;
  let obj;
  for (let i = 0; i < objects.length; i += 1) {
    objFields = {};
    obj = objectList[objects[i]];
    for (let f = 0; f < obj.fields.length; f += 1) {
      // Values we want for all fields.
      objFields.name = obj.fields[f].name;
      objFields.label = obj.fields[f].label;
      objFields.type = obj.fields[f].type;
      objFields.size = obj.fields[f].length;
      // Type specific values.
      switch (objFields.type) {
        case 'reference':
          objFields.target = obj.fields[f].referenceTo;
          break;
        case 'picklist':
          objFields.values = extractPicklistValues(obj.fields[f].picklistValues);
          break;
        default:
          break;
      }
    }
    schema[objects[i]] = objFields;
  }

  return schema;
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
        consoleWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Login Failed ${err}`,
        });

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
      consoleWindow.webContents.send('log_message', {
        sender: event.sender.getTitle(),
        channel: 'Info',
        message: `New Connection to ${conn.instanceUrl} with Access Token ${conn.accessToken}`,
      });
      consoleWindow.webContents.send('log_message', {
        sender: event.sender.getTitle(),
        channel: 'Info',
        message: `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`,
      });

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
        consoleWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Logout Failed ${err}`,
        });
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

        consoleWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Describe Global Failed ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
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
    let proposedSchema;

    // Create a collection of promises for the various objects.
    for (let i = 0; i < args.objects.length; i += 1) {
      describeCalls.push(conn.sobject(args.objects[i]).describe());
    }

    // Wait for all of them to resolve, and build a collection.
    Promise.all(describeCalls).then((responses) => {
      for (let i = 0; i < responses.length; i += 1) {
        objectDescribes[responses[i].name] = responses[i];
      }

      // Build draft schema.
      proposedSchema = proposeSchema(objectDescribes);

      // Send Schema to interface for review.
      consoleWindow.webContents.send('response_generic', {
        status: false,
        message: 'Got a lot of field data',
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
  // Send a log message to the console window.
  send_log: (event, args) => {
    consoleWindow.webContents.send('log_message', {
      sender: event.sender.getTitle(),
      channel: args.channel,
      message: args.message,
    });
    return true;
  },
};

exports.handlers = handlers;
exports.setwindow = setwindow;
