/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$.when($.ready).then(() => {
  // Hide the places for handling responses until we have some.
  $('#org-status').hide();
  $('#results-table-wrapper').hide();
  $('#results-message-wrapper').hide();
  $('#results-object-viewer-wrapper').hide();

  // Setup next buttons.
  $('button.btn-next').on('click', (event) => {
    event.preventDefault();
    const tab = $(event.target).data('next');
    $(tab).tab('show');
  });

  // Setup prev buttons.
  $('button.btn-prev').on('click', (event) => {
    event.preventDefault();
    const tab = $(event.target).data('prev');
    $(tab).trigger('click');
  });

  // Setup Find button.
  $('#btn-find-in-page').on('click', (event) => {
    event.preventDefault();
    let searchDir;
    // Get the search
    const searchText = $('#find-in-page-text').val().trim();

    // Trigger the search if text was provided.
    if (searchText) {
      // Set direction.
      searchDir = 'forward';
      if ($('#chk-find-direction').prop('checked')) {
        searchDir = 'back';
      }

      window.api.send('find_text', {
        text: searchText,
        direction: searchDir,
      });
    }
  });

  // Hide loader.
  $('#loader-indicator').hide();

  // Get the current application preferences.
  window.api.send('get_preferences');

  // Log a message that the interface is ready to go.
  window.api.send('send_log', {
    channel: 'Info',
    message: 'Main window initialized.',
  });
});

// ============= Helpers ==============
// Simple find and replace of text based on selector.
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

// Escapes HTML tags that may be headed to the log messages.
const escapeHTML = (html) => {
  const escape = document.createElement('textarea');
  escape.textContent = html;
  return escape.innerHTML;
};

/**
 * Displays an object as JSON in the raw response section of the interface.
 * @param {Object} responseObject The JSForce response object.
 */
const displayRawResponse = (responseObject) => {
  $('#raw-response').jsonViewer(responseObject, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

/**
 * Log a message to the console.
 * @param {String} context The part of the system that generated the message.
 * @param {String} importance The level of importance of the message.
 * @param {String} message The message to display.
 * @param {*} data Raw data to display in JSON viewer.
 */
function logMessage(context, importance, message, data) {
  // Create elements for display.
  const logTable = document.getElementById('consoleMessageTable');
  const row = logTable.insertRow(1);
  const mesImportance = document.createElement('td');
  const mesContext = document.createElement('td');
  const mesText = document.createElement('td');
  const mesData = document.createElement('td');

  // Add Classes.
  mesText.setAttribute('class', 'console-message');
  mesData.setAttribute('class', 'console-raw-data');

  // Set the row highlights as needed.
  switch (importance.toLowerCase()) {
    case 'error':
      row.className += 'table-danger';
      break;
    case 'warning':
    case 'warn':
      row.className += 'table-warning';
      break;
    case 'success':
      row.className += 'table-success';
      break;
    default:
      break;
  }

  // Add Text
  mesContext.innerHTML = context;
  mesImportance.innerHTML = importance;
  mesText.innerHTML = escapeHTML(message);

  // Attach Elements
  row.appendChild(mesImportance);
  row.appendChild(mesContext);
  row.appendChild(mesText);
  row.appendChild(mesData);

  if (data) {
    displayRawResponse(data);
    $('#consoleMessageTable :last-child td.console-raw-data').jsonViewer(data, {
      collapsed: true,
      rootCollapsable: false,
      withQuotes: true,
      withLinks: true,
    });
  }
}

/**
 * Reviews an org's list of objects to guess the org type
 * @param {Object} sObjectList The list of objects for the org.
 * @returns {String} org type. One of npsp, eda, other.
 */
const snifOrgType = (sObjectList) => {
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
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col') => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  headerRow.appendChild(newHeader);
};

/**
 * Attaches a new table cell to an existing row.
 * @param {Object} tableRow The DOM element to attach the new element to.
 * @param {object} content The content to put in the cell.
 * @param {boolean} isText Defines if the content should be treated as text or a sub-element.
 * @param {Integer} position The index to insert to new cell. Default -1 appends to the end.
 */
const generateTableCell = (tableRow, content, isText = true, position = -1) => {
  let contentNode;
  if (isText) {
    contentNode = document.createTextNode(content);
  } else {
    contentNode = content;
  }
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);
  if (position === -1) {
    tableRow.appendChild(cellNode);
  } else {
    tableRow.insertBefore(cellNode, tableRow.children[position]);
  }
};

const showLoader = (message) => {
  $('#loader-indicator .loader-message').text(message);
  $('#loader-indicator').show();
};

const hideLoader = () => {
  $('#loader-indicator').hide();
};

/**
 * Displays an object in the results-object-viewer section of the interface using JSONViewer.
 *
 * @param {Object} data The object to display, object must contain message and response attributes.
 */
const refreshObjectDisplay = (data) => {
  showLoader('Refreshing database schema display');
  $('#results-object-viewer-wrapper .results-summary h3').text(data.message);

  // When this is displaying a describe add a little helpful sumamry.
  if (Object.prototype.hasOwnProperty.call(data, 'response.fields')) {
    $('#results-object-viewer-wrapper .results-summary p').text(
      `Found ${data.response.fields.length} fields and ${data.response.recordTypeInfos.length} record types.`,
    );
  } else {
    $('#results-object-viewer-wrapper .results-summary p').text('');
  }

  $('#results-object-viewer').jsonViewer(data.response, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
  hideLoader();
};

// ================ Response Handlers =================

/**
 * Handles interface adjustments after login is complete.
 * @param {*} responseData The data sent from the main process.
 */
const handleLogin = (responseData) => {
  // Add the new connection to the list of options.
  const opt = document.createElement('option');
  opt.value = responseData.response.organizationId;
  opt.innerHTML = responseData.request.username;
  opt.id = `sforg-${opt.value}`;
  document.getElementById('active-org').appendChild(opt);

  // Shuffle what's shown.
  document.getElementById('org-status').style.display = 'block';
  replaceText('active-org-id', responseData.response.organizationId);
  replaceText('login-response-message', responseData.message);

  // Enable the button to fetch object list.
  $('#btn-fetch-objects').prop('disabled', false);
};

/**
 * Displays the list of objects from a Global describe query.
 * @param {Object} sObjectData The results from JSForce to display.
 */
const displayObjectList = (sObjectData) => {
  // Define  columns to display.
  const displayColumns = [
    'label',
    'name',
  ];

  // Different common packages beg for different sets of Standard objects as likely to be used.
  const selectStandardObjects = {
    npsp: [
      'Account',
      'Contact',
      'Campaign',
      'CampaignMember',
      'Case',
      'Document',
      'Opportunity',
      'OpportunityContactRole',
      'Task',
    ],
    eda: [
      'Account',
      'Contact',
      'Campaign',
      'CampaignMember',
      'Case',
      'Document',
      'Lead',
      'Task',
    ],
    other: [
      'Account',
      'Contact',
      'Campaign',
      'CampaignMember',
      'Case',
      'Document',
      'Lead',
      'Opportunity',
      'OpportunityContactRole',
      'Order',
      'OrderItem',
      'PriceBook2',
      'Product2',
      'Task',
    ],
  };

  // Display area.
  hideLoader();
  $('#results-table-wrapper').show();
  $('#results-object-viewer-wrapper').hide();
  $('#results-message-wrapper').hide();
  $('#results-summary-count').text(`Your orgs contains ${sObjectData.length} objects (custom and standard)`);

  const orgType = snifOrgType(sObjectData);

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add the header
  generateTableHeader(headRow, 'Select');
  for (let i = 0; i < displayColumns.length; i += 1) {
    generateTableHeader(headRow, displayColumns[i]);
  }

  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data in two passes: custom and selected standard objects, then all the others.
  let dataRow;
  const tBody = document.createElement('tbody');
  const orgSelects = selectStandardObjects[orgType];
  const displayed = [];
  let checkCell;
  // First pass for popular objects
  for (let i = 0; i < sObjectData.length; i += 1) {
    if (orgSelects.includes(sObjectData[i].name) || sObjectData[i].name.endsWith('__c')) {
      displayed.push(sObjectData[i].name);
      dataRow = document.createElement('tr');

      // Generate a checkbox
      checkCell = document.createElement('input');
      checkCell.type = 'checkbox';
      checkCell.checked = true;
      checkCell.dataset.objectName = sObjectData[i].name;
      generateTableCell(dataRow, checkCell, false);
      // Add the details
      for (let j = 0; j < displayColumns.length; j += 1) {
        generateTableCell(dataRow, sObjectData[i][displayColumns[j]]);
      }

      tBody.appendChild(dataRow);
    }
  }
  // Seconds pass for the rare ones.
  for (let i = 0; i < sObjectData.length; i += 1) {
    if (!displayed.includes(sObjectData[i].name) && sObjectData[i].createable) {
      dataRow = document.createElement('tr');

      // Generate a checkbox
      checkCell = document.createElement('input');
      checkCell.type = 'checkbox';
      checkCell.dataset.objectName = sObjectData[i].name;
      generateTableCell(dataRow, checkCell, false);
      // Add the details
      for (let j = 0; j < displayColumns.length; j += 1) {
        generateTableCell(dataRow, sObjectData[i][displayColumns[j]]);
      }

      tBody.appendChild(dataRow);
    }
  }

  resultsTable.appendChild(tBody);

  // Enable the button to fetch object list.
  $('#btn-fetch-details').prop('disabled', false);
};

/**
 * Displays the drafted schema in the JSONViewer
 * @param {*} schema the built-out schema from main thread.
 */
const displayDraftSchema = (schema) => {
  showLoader('All objects loaded, refreshing display');
  refreshObjectDisplay({
    message: 'Proposed Database Schema',
    response: schema,
  });
  $('#btn-generate-schema').prop('disabled', false);
  $('#btn-save-sf-schema').prop('disabled', false);
  $('#nav-schema-tab').tab('show');
  hideLoader();
};

// ========= Messages to the main process ===============
// Login
document.getElementById('login-trigger').addEventListener('click', () => {
  showLoader('Attemping Login');
  window.api.send('sf_login', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Logout
document.getElementById('logout-trigger').addEventListener('click', () => {
  const { value } = document.getElementById('active-org');
  window.api.send('sf_logout', {
    org: value,
  });
  // Remove from interface:
  const selectobject = document.getElementById('active-org');
  for (let i = 0; i < selectobject.length; i += 1) {
    if (selectobject.options[i].value === value) {
      selectobject.remove(i);
    }
  }
  document.getElementById('org-status').style.display = 'none';
});

// Fetch Org Objects
document.getElementById('btn-fetch-objects').addEventListener('click', () => {
  showLoader('Loading Object List');
  window.api.send('sf_describeGlobal', {
    org: document.getElementById('active-org').value,
  });
});

// Fetch Object Field lists
document.getElementById('btn-fetch-details').addEventListener('click', () => {
  const activeCheckboxes = document.querySelectorAll('input[type=checkbox]:checked');
  const selectedObjects = [];
  for (let i = 0; i < activeCheckboxes.length; i += 1) {
    selectedObjects.push(activeCheckboxes[i].dataset.objectName);
  }
  showLoader('Loading Object Fields');
  window.api.send('sf_getObjectFields', {
    org: document.getElementById('active-org').value,
    objects: selectedObjects,
  });
});

// Build database (including database connection)
document.getElementById('schema-trigger').addEventListener('click', () => {
  const dbTypes = document.getElementsByName('db-radio-selectors');
  let dbType;
  for (let i = 0; i < dbTypes.length; i += 1) {
    if (dbTypes[i].checked) {
      dbType = dbTypes[i].value;
      break;
    }
  }

  showLoader('Creating Database Tables');

  window.api.send('knex_schema', {
    type: dbType,
    host: document.getElementById('db-host').value,
    username: document.getElementById('db-username').value,
    password: document.getElementById('db-password').value,
    dbname: document.getElementById('db-name').value,
    overwrite: document.getElementById('db-overwrite').checked,
  });
});

// Save the database create statement to a file.
document.getElementById('btn-save-sql-schema').addEventListener('click', () => {
  const dbTypes = document.getElementsByName('db-radio-selectors');
  let dbType;
  for (let i = 0; i < dbTypes.length; i += 1) {
    if (dbTypes[i].checked) {
      dbType = dbTypes[i].value;
      break;
    }
  }
  window.api.send('save_ddl_sql', {
    type: dbType,
    host: document.getElementById('db-host').value,
    username: document.getElementById('db-username').value,
    password: document.getElementById('db-password').value,
    dbname: document.getElementById('db-name').value,
    overwrite: document.getElementById('db-overwrite').checked,
  });
});

document.getElementById('btn-save-sf-schema').addEventListener('click', () => {
  window.api.send('save_schema');
});

document.getElementById('btn-load-sf-schema').addEventListener('click', () => {
  window.api.send('load_schema');
});

// ===== Response handlers from IPC Messages to render context ======
// Login response.
window.api.receive('response_login', (data) => {
  hideLoader();
  if (data.status) {
    handleLogin(data);
    logMessage('Salesforce', 'Success', data.message, data.response);
  } else {
    logMessage('Salesforce', 'Error', data.message, data.response);
    displayRawResponse(data);
  }
});

// Logout Response.
window.api.receive('response_logout', (data) => {
  logMessage('Salesforce', 'Info', 'Log out complete', data);
});

// Generic Response.
window.api.receive('response_generic', (data) => {
  logMessage('Generic Handler', 'Info', 'Generic Response Handler Triggered.', data);
});

// Response after building database
window.api.receive('response_db_generated', (data) => {
  hideLoader();
  logMessage('Database', 'Info', 'Database generation complete.', data);
  $('#btn-save-sql-schema').prop('disabled', false);
});

window.api.receive('response_schema', (data) => {
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  logMessage('Schema', 'Success', 'Draft schema built', data);
  displayDraftSchema(data.response.schema);
});

// List Objects From Global Describe.
window.api.receive('response_list_objects', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'block';
  if (data.status) {
    logMessage('Salesforce', 'Info', `Retrieved ${data.response.sobjects.length} SObjects from Salesforce`, data);
    displayObjectList(data.response.sobjects);
  } else {
    logMessage('Salesforce', 'Error', 'Error while retreiving object listing.', data);
  }
});

// Process a log message.
window.api.receive('log_message', (data) => {
  logMessage(data.sender, data.channel, data.message);
});

// Respond to updates to the preferences.
window.api.receive('current_preferences', (data) => {
  // Update the theme:
  const cssPath = `../node_modules/bootswatch/dist/${data.theme.toLowerCase()}/bootstrap.min.css`;
  document.getElementById('css-theme-link').href = cssPath;
});

// Start the find process by activating the controls and scrolling there.
window.api.receive('start_find', () => {
  const findbox = document.getElementById('find-in-page-text');
  findbox.scrollIntoView();
  findbox.focus();
});

// Update the current loader message.
window.api.receive('update_loader', (data) => {
  showLoader(data.message);
});
