/**
 * @jest-environment jsdom
*/
/* global render */

beforeAll(() => {
  global.$ = require('../../node_modules/jquery/dist/jquery.min'); // eslint-disable-line
  global.window = window;
  // Electron IPC Mock
  global.window.api = {
    receive: jest.fn(),
    send: jest.fn(),
  };
  // JSONViewer Mock
  global.$.fn.jsonViewer = jest.fn();
  // Bootstrap tab plugin stub (used by displayDraftSchema)
  global.$.fn.tab = jest.fn();
});

beforeEach(() => {
  jest.resetModules();
  // Load index.html since render.js assumes it's structures.
  const fs = require('fs');  // eslint-disable-line
  const indexHtml = fs.readFileSync('app/tests/minIndex.html');
  document.body.innerHTML = indexHtml.toString();
  window.api.send.mockClear();
  window.api.receive.mockClear();
  global.render = require('../render');  // eslint-disable-line
});

test('Test Replace Text', () => {
  const replaceText = render.__get__('replaceText');
  replaceText('consoleModalLabel', 'Bar');
  expect(document.getElementById('consoleModalLabel').innerText).toEqual('Bar');
});

test('Test Escape HTML', () => {
  const escapeHtml = render.__get__('escapeHTML');
  const escapedText = escapeHtml('<p>An HTML String that could contain <script>bad things</script></p>');
  expect(escapedText).toEqual('&lt;p&gt;An HTML String that could contain &lt;script&gt;bad things&lt;/script&gt;&lt;/p&gt;');
});

test('Test Display Raw Response', () => {
  const displayRawResponse = render.__get__('displayRawResponse');
  displayRawResponse({ Message: 'Hello Jest Testing' });
  expect('Fully Mocked').toEqual('Fully Mocked');
});

test('Test Message Logging', () => {
  const logMessage = render.__get__('logMessage');
  const logTable = document.getElementById('consoleMessageTable');
  const beforeCount = logTable.rows.length;
  logMessage('Test', 'Info', 'Test Message TestWordForSearch', { raw: 'data' });
  const afterCount = logTable.rows.length;
  expect(afterCount).toEqual(beforeCount + 1);
  expect(logTable.innerHTML.indexOf('TestWordForSearch')).toBeGreaterThan(-1);
});

test('Test getTableColumn', () => {
  const getTableColumn = render.__get__('getTableColumn');

  const tableHtml = '<table id="testTable"><tr><td>one</td><td>two</td></tr></table>';
  const template = document.createElement('template');
  template.innerHTML = tableHtml;
  const col = getTableColumn(template.content.firstChild, 0);
  expect(col[0].innerHTML).toEqual('one');
  const col2 = getTableColumn(template.content.firstChild, 1);
  expect(col2[0].innerHTML).toEqual('two');
});

// test('Test sortObjectTable', () => {
//   const sortObjectTable = render.__get__('sortObjectTable');
//   sortObjectTable();
//   expect('Test Stub').toEqual('Test Stub');
// });

test('Test generateTableHeader', () => {
  const generateTableHeader = render.__get__('generateTableHeader');
  const row = document.createElement('tr');

  const colTh = generateTableHeader(row, 'Hello', 'col');
  const rowTh = generateTableHeader(row, 'GoodBye', 'row');

  expect(row.childNodes).toHaveLength(2);
  expect(colTh.innerHTML).toEqual('Hello');
  expect(rowTh.innerHTML).toEqual('GoodBye');
  expect(colTh.scope).toEqual('col');
  expect(rowTh.scope).toEqual('row');
});

test('Test generateTableCell', () => {
  const generateTableCell = render.__get__('generateTableCell');
  const tableRow = document.createElement('tr');
  const content = 'Hello';

  let newCell = generateTableCell(tableRow, content, true);

  expect(tableRow.cells).toHaveLength(1);
  expect(newCell.firstChild.data).toEqual(content);

  const htmlContent = '<p>tagged content</p>';
  const template = document.createElement('template');
  template.innerHTML = htmlContent;
  newCell = generateTableCell(tableRow, template.content.firstChild, false, 1);

  expect(tableRow.cells).toHaveLength(2);
  expect(newCell.innerHTML).toEqual(htmlContent);
});

test('Test showLoader', () => {
  const showLoader = render.__get__('showLoader');
  const message = 'Loader message';
  showLoader(message);

  const loaderElement = document.getElementById('loader-indicator');
  const displayValue = window.getComputedStyle(loaderElement, null).display;
  expect(displayValue).toEqual('block');
  const messageElement = loaderElement.querySelector('.loader-message');
  expect(messageElement.innerHTML).toEqual(message);
});

test('Test hideLoader', () => {
  const hideLoader = render.__get__('hideLoader');
  hideLoader();
  const loaderElement = document.getElementById('loader-indicator');
  const displayValue = window.getComputedStyle(loaderElement, null).display;
  expect(displayValue).toEqual('none');
});

test('Test updateMessage', () => {
  const updateMessage = render.__get__('updateMessage');
  const message = 'Test message';
  updateMessage(message);
  const messageElement = document.getElementById('results-message-only');
  expect(messageElement.innerText).toEqual(message);
});

// test('Test refreshObjectDisplay', () => {
//   const refreshObjectDisplay = render.__get__('refreshObjectDisplay');
//   refreshObjectDisplay();
//   expect('Test Stub').toEqual('Test Stub');
// });

// ---- fetchOrgUser ----

test('fetchOrgUser returns empty string for an unknown org id', () => {
  const fetchOrgUser = render.__get__('fetchOrgUser');
  expect(fetchOrgUser('unknown-org')).toEqual('');
});

test('fetchOrgUser returns the connected username when present', () => {
  const fetchOrgUser = render.__get__('fetchOrgUser');
  document.getElementById('active-org-user').innerText = 'user@example.com';
  expect(fetchOrgUser('abc123')).toEqual('user@example.com');
});

// ---- handleLogin ----

test('handleLogin shows connection status and enables fetch-objects', () => {
  const handleLogin = render.__get__('handleLogin');
  const data = {
    message: 'Welcome',
    request: { username: 'admin@example.com' },
    response: { organizationId: 'org001' },
  };
  handleLogin(data);

  expect(document.getElementById('active-org-user').innerText).toEqual('admin@example.com');
  expect(document.getElementById('active-org-id').innerText).toEqual('org001');
  expect(document.getElementById('org-status').style.display).toEqual('block');
  expect(document.getElementById('btn-fetch-objects').disabled).toBe(false);
});

// ---- displayObjectList ----

test('displayObjectList renders one row per createable object', () => {
  const displayObjectList = render.__get__('displayObjectList');
  const sObjects = [
    { name: 'Account', label: 'Account', createable: true },
    { name: 'Contact', label: 'Contact', createable: true },
    { name: 'Task', label: 'Task', createable: false },
  ];

  displayObjectList('', sObjects, []);

  const tbody = document.getElementById('results-table').getElementsByTagName('tbody')[0];
  expect(tbody.rows).toHaveLength(2);
});

test('displayObjectList renders selected objects as the first rows when not pre-sorted', () => {
  const displayObjectList = render.__get__('displayObjectList');
  const sObjects = [
    { name: 'Account', label: 'Account', createable: true },
    { name: 'Contact', label: 'Contact', createable: true },
  ];

  displayObjectList('', sObjects, ['Contact']);

  const tbody = document.getElementById('results-table').getElementsByTagName('tbody')[0];
  const firstCheckbox = tbody.rows[0].cells[0].querySelector('input[type=checkbox]');
  expect(firstCheckbox.dataset.objectName).toEqual('Contact');
});

// ---- sortObjectTable ----

test('sortObjectTable re-renders table rows in ascending label order', () => {
  const displayObjectList = render.__get__('displayObjectList');
  const sortObjectTable = render.__get__('sortObjectTable');
  const sObjects = [
    { name: 'Zzz', label: 'Zzz', createable: true },
    { name: 'Aaa', label: 'Aaa', createable: true },
  ];

  // Populate the table first so sortObjectTable has data-rowData to read.
  displayObjectList('', sObjects, [], true, 'label', 'ASC');
  sortObjectTable('label', 'ASC');

  const tbody = document.getElementById('results-table').getElementsByTagName('tbody')[0];
  // Column 0 = select checkbox; column 1 = label.
  expect(tbody.rows[0].cells[1].textContent).toEqual('Aaa');
});

test('sortObjectTable re-renders table rows in descending label order', () => {
  const displayObjectList = render.__get__('displayObjectList');
  const sortObjectTable = render.__get__('sortObjectTable');
  const sObjects = [
    { name: 'Aaa', label: 'Aaa', createable: true },
    { name: 'Zzz', label: 'Zzz', createable: true },
  ];

  displayObjectList('', sObjects, [], true, 'label', 'ASC');
  sortObjectTable('label', 'DESC');

  const tbody = document.getElementById('results-table').getElementsByTagName('tbody')[0];
  expect(tbody.rows[0].cells[1].textContent).toEqual('Zzz');
});

// ---- IPC receive callbacks ----

// Helper: retrieve the callback registered for a given channel via window.api.receive.
const getReceiveCallback = (channel) => {
  const entry = window.api.receive.mock.calls.find(([ch]) => ch === channel);
  return entry ? entry[1] : undefined;
};

test('response_login success path updates login message and enables fetch-objects button', () => {
  const cb = getReceiveCallback('response_login');
  cb({
    status: true,
    message: 'Login successful',
    request: { username: 'admin@example.com' },
    response: { organizationId: 'org999' },
  });
  expect(document.getElementById('login-response-message').innerText).toEqual('Login successful');
  expect(document.getElementById('btn-fetch-objects').disabled).toBe(false);
});

test('login trigger sends the selected connection mode', () => {
  document.getElementById('sfconnect-password').checked = true;
  document.getElementById('login-trigger').click();

  expect(window.api.send).toHaveBeenCalledWith(
    'sf_login',
    expect.objectContaining({
      mode: 'password',
    }),
  );
});

test('response_login error path logs an error row and updates status message', () => {
  const cb = getReceiveCallback('response_login');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ status: false, message: 'Invalid credentials', response: {} });
  expect(logTable.rows.length).toBeGreaterThan(before);
  expect(document.getElementById('results-message-only').innerText).toEqual('Login Error');
});

test('response_logout logs a message and updates the status text', () => {
  const cb = getReceiveCallback('response_logout');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ message: 'Logged out', response: {} });
  expect(logTable.rows.length).toBeGreaterThan(before);
  expect(document.getElementById('results-message-only').innerText)
    .toEqual('Salesforce connection removed.');
});

test('response_error logs an error row', () => {
  const cb = getReceiveCallback('response_error');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ message: 'Something broke', response: 'Error details' });
  expect(logTable.rows.length).toBeGreaterThan(before);
});

test('response_list_objects success populates the object table with createable objects', () => {
  const cb = getReceiveCallback('response_list_objects');
  cb({
    status: true,
    request: { org: '' },
    response: {
      sobjects: [
        { name: 'Account', label: 'Account', createable: true },
        { name: 'Lead', label: 'Lead', createable: true },
        { name: 'Activity', label: 'Activity', createable: false },
      ],
      recommended: [],
    },
  });
  const tbody = document.getElementById('results-table').getElementsByTagName('tbody')[0];
  expect(tbody.rows).toHaveLength(2);
});

test('response_list_objects error path logs an error row', () => {
  const cb = getReceiveCallback('response_list_objects');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ status: false, request: {}, response: {} });
  expect(logTable.rows.length).toBeGreaterThan(before);
});

test('response_schema makes the object viewer visible and logs a success row', () => {
  const cb = getReceiveCallback('response_schema');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ request: { org: '' }, response: { schema: { Account: {} } } });
  expect(document.getElementById('results-object-viewer-wrapper').style.display).toEqual('block');
  expect(logTable.rows.length).toBeGreaterThan(before);
});

test('response_db_generated full success logs completion and updates message', () => {
  const cb = getReceiveCallback('response_db_generated');
  const logTable = document.getElementById('consoleMessageTable');
  const before = logTable.rows.length;
  cb({ response: {}, responses: { Account: true, Contact: true } });
  expect(logTable.rows.length).toBeGreaterThan(before);
  expect(document.getElementById('results-message-only').innerText)
    .toEqual('Database creation complete, all tables created');
});

test('response_db_generated full failure updates message to all-failed text', () => {
  const cb = getReceiveCallback('response_db_generated');
  // Omit the 'response' key so hasResponses=false, which initialises fullFailure=true.
  cb({ responses: { Account: false } });
  expect(document.getElementById('results-message-only').innerText)
    .toEqual('Error creating database tables, all tables failed');
});

test('response_db_generated partial success updates message with some-tables-had-error text', () => {
  const cb = getReceiveCallback('response_db_generated');
  cb({ response: {}, responses: { Account: true, Contact: false } });
  expect(document.getElementById('results-message-only').innerText)
    .toContain('some tables had error');
});
