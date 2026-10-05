/**
 * @jest-environment jsdom
*/
/* global render */

beforeAll(() => {
  global.$ = require('../../node_modules/jquery/dist/jquery.min'); // eslint-disable-line
  // jsdom never triggers jQuery's ready event, so fire it to run the
  // document-ready setup in render.js.
  global.$.ready();
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

// DEPRECATED(password-login): remove this test when #290 is done.
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

// Simulates the main process reporting the OAuth setup status.
const sendPreferences = (oauth) => {
  getReceiveCallback('current_preferences')({ theme: 'Cyborg', oauth });
};
const configuredOAuth = { clientId: 'cid', hasClientSecret: true, callbackPort: 3835 };

test('OAuth login trigger waits for the browser sign-in', () => {
  sendPreferences(configuredOAuth);
  document.getElementById('login-url').value = 'https://myco.my.salesforce.com';
  document.getElementById('login-trigger').click();

  expect(window.api.send).toHaveBeenCalledWith(
    'sf_login',
    expect.objectContaining({
      mode: 'oauth',
      url: 'https://myco.my.salesforce.com',
    }),
  );
  expect(document.querySelector('#loader-indicator .loader-message').textContent)
    .toEqual('Waiting for browser sign-in…');
});

test('OAuth login is refused until the External Client App is set up', () => {
  sendPreferences({ clientId: '', hasClientSecret: false, callbackPort: 3835 });
  expect(document.getElementById('login-trigger').disabled).toBe(true);
  expect(document.getElementById('oauth-config-status').innerText).toContain('not set up');

  // The click handler also refuses, in case the button state is stale.
  document.getElementById('login-trigger').disabled = false;
  document.getElementById('login-url').value = 'https://myco.my.salesforce.com';
  document.getElementById('login-trigger').click();

  expect(window.api.send).not.toHaveBeenCalledWith('sf_login', expect.anything());
  const message = document.getElementById('login-modal-message');
  expect(message.classList.contains('d-none')).toBe(false);
  expect(message.textContent).toContain('Preferences');
});

test('OAuth login is refused for login and test URLs', () => {
  sendPreferences(configuredOAuth);
  expect(document.getElementById('login-trigger').disabled).toBe(false);

  ['https://login.salesforce.com', 'https://test.salesforce.com', 'not-a-url'].forEach((url) => {
    window.api.send.mockClear();
    document.getElementById('login-url').value = url;
    document.getElementById('login-trigger').click();

    expect(window.api.send).not.toHaveBeenCalledWith('sf_login', expect.anything());
    expect(document.getElementById('login-modal-message').textContent).toContain('My Domain');
  });
});

test('isMyDomainUrl only accepts HTTPS My Domain URLs', () => {
  const isMyDomainUrl = render.__get__('isMyDomainUrl');
  expect(isMyDomainUrl('https://myco.my.salesforce.com')).toBe(true);
  expect(isMyDomainUrl('https://myco--dev.sandbox.my.salesforce.com')).toBe(true);
  expect(isMyDomainUrl('http://myco.my.salesforce.com')).toBe(false);
  expect(isMyDomainUrl('https://login.salesforce.com')).toBe(false);
  expect(isMyDomainUrl('https://test.salesforce.com')).toBe(false);
  expect(isMyDomainUrl('')).toBe(false);
});

// DEPRECATED(password-login): remove this test when #290 is done.
test('password login is not blocked by missing OAuth setup', () => {
  sendPreferences({ clientId: '', hasClientSecret: false, callbackPort: 3835 });
  const passwordRadio = document.getElementById('sfconnect-password');
  passwordRadio.checked = true;
  passwordRadio.dispatchEvent(new Event('change'));

  expect(document.getElementById('login-trigger').disabled).toBe(false);
  expect(document.getElementById('login-url').value).toBe('https://login.salesforce.com');

  // Switching back to OAuth drops the login URL, since OAuth can't use it.
  const oauthRadio = document.getElementById('sfconnect-oauth');
  oauthRadio.checked = true;
  oauthRadio.dispatchEvent(new Event('change'));
  expect(document.getElementById('login-url').value).toBe('');
  expect(document.getElementById('login-trigger').disabled).toBe(true);
});

test('opening the login window refreshes the OAuth setup status', () => {
  window.api.send.mockClear();
  document.getElementById('loginModal').dispatchEvent(new Event('show.bs.modal'));
  expect(window.api.send).toHaveBeenCalledWith('get_preferences');
});

test('login modal notes that OAuth requires the My Domain URL', () => {
  const note = document.getElementById('oauth-my-domain-note').textContent;
  expect(note).toContain('My Domain');
  expect(note).toContain('https://login.salesforce.com');
  expect(note).toContain('https://test.salesforce.com');
});

test('Create New Connection is hidden while connected and restored on logout', () => {
  const newConnection = document.getElementById('btn-new-connection');
  getReceiveCallback('response_login')({
    status: true,
    message: 'Login Successful',
    request: { mode: 'oauth' },
    response: { organizationId: 'org1', username: 'user@example.com' },
  });
  expect(newConnection.style.display).toBe('none');

  document.getElementById('logout-trigger').click();
  expect(newConnection.style.display).toBe('');
  expect(window.api.send).toHaveBeenCalledWith('sf_logout', {});
});

// DEPRECATED(password-login): remove this test when #290 is done.
test('Username/Password option is labeled deprecated with a warning', () => {
  expect(document.querySelector('label[for=sfconnect-password]').textContent)
    .toContain('(deprecated)');
  expect(document.getElementById('login-password-deprecated').textContent)
    .toContain('will be removed in a future version');
});

// jQuery runs the document-ready setup through nested timers.
const waitForReady = () => new Promise((resolve) => { setTimeout(resolve, 10); });

test('preferences are requested once on load', async () => {
  // Flush setup queued by earlier tests, then load render.js exactly once.
  await waitForReady();
  window.api.send.mockClear();
  jest.resetModules();
  require('../render'); // eslint-disable-line
  await waitForReady();

  const prefCalls = window.api.send.mock.calls.filter((c) => c[0] === 'get_preferences');
  expect(prefCalls).toHaveLength(1);
});

test('Select All and Clear toggle every object checkbox', async () => {
  await waitForReady();
  const displayObjectList = render.__get__('displayObjectList');
  displayObjectList('', [
    { name: 'Account', label: 'Account', createable: true },
    { name: 'Contact', label: 'Contact', createable: true },
  ], []);
  const boxes = () => Array.from(document.querySelectorAll('#results-table input[type=checkbox]'));
  expect(boxes().length).toBeGreaterThan(0);

  document.getElementById('btn-select-all-objects').click();
  expect(boxes().every((box) => box.checked)).toBe(true);

  document.getElementById('btn-deselect-all-objects').click();
  expect(boxes().some((box) => box.checked)).toBe(false);
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
