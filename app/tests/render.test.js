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
});

beforeEach(() => {
  // Load index.html since render.js assumes it's structures.
  const fs = require('fs');  // eslint-disable-line
  const indexHtml = fs.readFileSync('app/tests/minIndex.html');
  document.body.innerHTML = indexHtml.toString();
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
test('Test sortObjectTable', () => {
  const sortObjectTable = render.__get__('sortObjectTable');
  sortObjectTable();
  expect('Test Stub').toEqual('Test Stub');
});
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
  generateTableCell();
  expect('Test Stub').toEqual('Test Stub');
});
test('Test showLoader', () => {
  const showLoader = render.__get__('showLoader');
  showLoader();
  expect('Test Stub').toEqual('Test Stub');
});
test('Test hideLoader', () => {
  const hideLoader = render.__get__('hideLoader');
  hideLoader();
  expect('Test Stub').toEqual('Test Stub');
});
test('Test updateMessage', () => {
  const updateMessage = render.__get__('updateMessage');
  updateMessage();
  expect('Test Stub').toEqual('Test Stub');
});
test('Test refreshObjectDisplay', () => {
  const refreshObjectDisplay = render.__get__('refreshObjectDisplay');
  refreshObjectDisplay();
  expect('Test Stub').toEqual('Test Stub');
});
