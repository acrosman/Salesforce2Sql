/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$.when($.ready).then(() => {
  // Get the current application preferences.
  window.api.send('get_preferences');

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
    $(tab).tab('show');
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

  // Setup Object Select All
  $('#btn-select-all-objects').on('click', (event) => {
    event.preventDefault();
    $('#results-table input[type=checkbox]').prop('checked', true);
  });

  // Setup Object Select All
  $('#btn-deselect-all-objects').on('click', (event) => {
    event.preventDefault();
    $('#results-table input[type=checkbox]').prop('checked', false);
  });

  // Hide loader.
  $('#loader-indicator').hide();
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
    $(mesData).jsonViewer(data, {
      collapsed: true,
      rootCollapsable: false,
      withQuotes: true,
      withLinks: true,
    });
  }
}

/**
 * From a DOM element containing table rows to extract a column from.
 * @param {domElement} ele A dom element containing table rows.
 * @param {Integer} columnIndex The integer of the column to extract.
 * @returns An array of table cells (td) from requested column.
 */
function getTableColumn(ele, columnIndex) {
  const col = [];
  const rows = ele.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i += 1) {
    col.push(rows[i].cells[columnIndex]);
  }

  return col;
}

/**
 * Sort the Object table by column. Uses a decorate, sort, un-decorate approach.
 * @param {String} sortProperty The name of the property to sort the data by.
 * @param {String} direction The sorting direction: ASC or DESC.
 */
function sortObjectTable(sortProperty, direction = 'ASC') {
  const table = document.getElementById('results-table');
  const tableBody = table.getElementsByTagName('tbody')[0];
  const dir = direction.toUpperCase();
  const sortData = [];
  const renderData = [];
  const selected = [];

  // Extract the table's Select cells.
  const column = getTableColumn(tableBody, 0);

  // Build a list to sort keyed by the property in question.
  column.forEach((cell) => {
    const rowData = JSON.parse(cell.dataset.rowData);
    if (cell.firstChild.checked) {
      selected.push(rowData.name);
    }
    // For the named properties, we just use those.
    if (sortProperty !== 'Select') {
      sortData.push([rowData[sortProperty], rowData]);
    } else {
      // For the select we need the checked status, which is now
      // membership in the selected list.
      sortData.push([selected.includes(rowData.name), rowData]);
    }
  });

  // Pre-sort the selected list incase we need it in a sec.
  selected.sort();

  // Sort the list.
  sortData.sort((a, b) => {
    // Assume everything is equal.
    let order = 0;
    // For the non-selects we just sort by the first array element.
    if (sortProperty !== 'Select') {
      if (a[0] > b[0]) {
        order = 1;
      }
      if (a[0] < b[0]) {
        order = -1;
      }
    } else {
      // For the selects, we sort by the first array element, and the name.
      // When a is checked and b is not, a wins.
      if (a[0] && !b[0]) {
        order = 1;
      }
      // When a is checked and a is not, b wins.
      if (!a[0] && b[0]) {
        order = -1;
      }
      // When both are checked or unchecked, name sort.
      if ((a[0] && b[0]) || (!a[0] && !b[0])) {
        if (a[1].name < b[1].name) {
          order = 1;
        }
        if (a[1].name > b[1].name) {
          order = -1;
        }
      }
    }
    return order;
  });

  if (dir === 'DESC') {
    sortData.reverse();
  }

  // Un-decorate the list for rendering.
  sortData.forEach((row) => {
    renderData.push(row[1]);
  });

  // Trigger re-render of the table.
  // This is a circular reference so no lint error for you.
  // eslint-disable-next-line no-use-before-define
  displayObjectList(renderData, selected, true, sortProperty, dir);
}

/**
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 * @returns The new header element created.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col') => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  headerRow.appendChild(newHeader);
  return newHeader;
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

  // Create the content of the cell as text or a DOM element.
  if (isText) {
    contentNode = document.createTextNode(content);
  } else {
    contentNode = content;
  }
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);

  // Add the new cell to the row using position if given.
  if (position === -1) {
    tableRow.appendChild(cellNode);
  } else {
    tableRow.insertBefore(cellNode, tableRow.children[position]);
  }

  return cellNode;
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

  // When this is displaying a describe add a little helpful summary.
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
 * @param {Array} selected The list of objects to set as selected.
 * @param {boolean} sorted When true, the list will be rendered in the order provided,
 *  otherwise it will sort selected first.
 * @param {String} sortedColumn The name of the column the data is sorted by to set label.
 */
const displayObjectList = (sObjectData, selected, sorted = false, sortedColumn = 'Select', sortedDirection = 'ASC') => {
  // Define  columns to display.
  const displayColumns = [
    'label',
    'name',
  ];

  // Display area.
  // @todo: remove jquery use.
  hideLoader();
  $('#results-table-wrapper').show();
  $('#results-object-viewer-wrapper').hide();
  $('#results-message-wrapper').hide();
  $('#results-summary-count').text('Loading objects...');

  // Get the table.
  const resultsTable = document.getElementById('results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.lastChild);
  }

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add the header
  let th;
  let nextSort = 'ASC';

  // First add the column for the select boxes.
  th = generateTableHeader(headRow, 'Select');
  if (sortedColumn === 'Select') {
    th.dataset.sortDirection = sortedDirection;
    if (sortedDirection === 'ASC') {
      th.classList.add('bi', 'bi-arrow-down');
      th.ariaLabel = 'Select sorted selected first';
      nextSort = 'DESC';
    } else {
      th.classList.add('bi', 'bi-arrow-up');
      th.ariaLabel = 'Select sorted selected last';
    }
  }

  // Since we go on to use nextSort in the loop below the reference
  // that gets passed here would be bad, so switch back to actual string.
  if (nextSort === 'DESC') {
    th.addEventListener('click', () => {
      sortObjectTable('Select', 'DESC');
    });
  } else {
    th.addEventListener('click', () => {
      sortObjectTable('Select', 'ASC');
    });
  }

  // Add all other columns.
  for (let i = 0; i < displayColumns.length; i += 1) {
    nextSort = 'ASC';
    th = generateTableHeader(headRow, displayColumns[i]);
    if (sortedColumn === displayColumns[i]) {
      th.dataset.sortDirection = sortedDirection;
      if (sortedDirection === 'ASC') {
        th.classList.add('bi', 'bi-arrow-up');
        th.ariaLabel = `${displayColumns[i]} sorted ascending.`;
        nextSort = 'DESC';
      } else {
        th.classList.add('bi', 'bi-arrow-down');
        th.ariaLabel = `${displayColumns[i]} sorted descending.`;
      }
    }

    // Yes, this looks odd, but it makes the linter happy. Which is good
    // cause it's easy to make a confusing error here and pass the last
    // value instead of the current value.
    if (nextSort === 'DESC') {
      th.addEventListener('click', () => {
        sortObjectTable(displayColumns[i], 'DESC');
      });
    } else {
      th.addEventListener('click', () => {
        sortObjectTable(displayColumns[i], 'ASC');
      });
    }
  }

  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data in two passes: recommended objects for selection, then all the others.
  // Gives us a default sort in O(n).
  let dataRow;
  const tBody = document.createElement('tbody');
  const displayed = [];
  let checkCell;
  let selectCell;
  let objCount = 0;

  // If not sorted yet, run a pass to rendered selected objects first
  if (!sorted) {
    sObjectData.forEach((sobj) => {
      const { name } = sobj;
      if (selected.includes(name)) {
        displayed.push(sobj.name);
        dataRow = document.createElement('tr');

        // Generate a checkbox
        checkCell = document.createElement('input');
        checkCell.type = 'checkbox';
        checkCell.checked = true;
        checkCell.dataset.objectName = sobj.name;
        selectCell = generateTableCell(dataRow, checkCell, false);

        // Add the details
        for (let j = 0; j < displayColumns.length; j += 1) {
          generateTableCell(dataRow, sobj[displayColumns[j]]);
        }

        // Add the data for this row to the select cell for easy access during sorting.
        selectCell.dataset.rowData = JSON.stringify(sobj);

        // Add the new row to the table body.
        tBody.appendChild(dataRow);
        objCount += 1;
      }
    });
  }

  // Render all objects not already on the list. If the list is sorted this will be
  // all objects. If the list is unsorted the selected objects were already rendered.
  sObjectData.forEach((sobj) => {
    if (!displayed.includes(sobj.name) && sobj.createable) {
      dataRow = document.createElement('tr');

      // Generate a checkbox
      checkCell = document.createElement('input');
      checkCell.type = 'checkbox';
      checkCell.dataset.objectName = sobj.name;
      checkCell.checked = selected.includes(sobj.name);
      selectCell = generateTableCell(dataRow, checkCell, false);
      // Add the details
      for (let j = 0; j < displayColumns.length; j += 1) {
        generateTableCell(dataRow, sobj[displayColumns[j]]);
      }

      // Add the data for this row to the select cell for easy access during sorting.
      selectCell.dataset.rowData = JSON.stringify(sobj);

      // Add to the end of the table.
      tBody.appendChild(dataRow);
      objCount += 1;
    }
  });

  // Add the whole table body to the table itself.
  resultsTable.appendChild(tBody);

  $('#results-summary-count').text(`Your org contains ${objCount} creatable objects`);

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
  showLoader('Attempting Login');
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
  const selectObject = document.getElementById('active-org');
  for (let i = 0; i < selectObject.length; i += 1) {
    if (selectObject.options[i].value === value) {
      selectObject.remove(i);
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
    port: document.getElementById('db-port').value,
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
window.api.receive('response_error', (data) => {
  hideLoader();
  logMessage(data.message, 'Error', data.response, data);
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
    displayObjectList(data.response.sobjects, data.response.recommended);
  } else {
    logMessage('Salesforce', 'Error', 'Error while retrieving object listing.', data);
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
  const findBox = document.getElementById('find-in-page-text');
  findBox.scrollIntoView();
  findBox.focus();
});

// Update the current loader message.
window.api.receive('update_loader', (data) => {
  showLoader(data.message);
});
