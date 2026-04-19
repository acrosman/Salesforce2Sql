const electron = require('electron'); // eslint-disable-line no-unused-vars
const find = require('../find');

// find.js holds module-level state (currentSearchText, searchEnabled).
// Reset it before each test via babel-plugin-rewire so tests are independent.
beforeEach(() => {
  find.__set__('currentSearchText', undefined);
  find.__set__('searchEnabled', false);
});

// Creates a pageContent stub with the methods used by find.js.
const makePageContent = () => ({
  on: jest.fn(),
  send: jest.fn(),
  findInPage: jest.fn(),
  stopFindInPage: jest.fn(),
});

test('jumpToFind sends start_find to the focused window', () => {
  const focusedWindow = { webContents: { send: jest.fn() } };
  find.jumpToFind(null, focusedWindow);
  expect(focusedWindow.webContents.send).toHaveBeenCalledWith('start_find');
});

test('enableSearch registers a found-in-page listener on first executeSearch call', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'test', 'forward');
  expect(pageContent.on).toHaveBeenCalledWith('found-in-page', expect.any(Function));
  expect(find.__get__('searchEnabled')).toBe(true);
});

test('enableSearch found-in-page callback sends log_message with match count and search text', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'test', 'forward');

  // Capture and invoke the registered found-in-page callback.
  const [, foundCallback] = pageContent.on.mock.calls.find(([evt]) => evt === 'found-in-page');
  foundCallback({}, { matches: 3 });

  expect(pageContent.send).toHaveBeenCalledWith(
    'log_message',
    expect.objectContaining({
      sender: 'Find',
      channel: 'Info',
      message: expect.stringContaining('test'),
    }),
  );
});

test('executeSearch calls findInPage with forward:true and findNext:false for new search text', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'hello', 'forward');
  expect(pageContent.findInPage).toHaveBeenCalledWith('hello', {
    forward: true,
    findNext: false,
    matchCase: true,
  });
});

test('executeSearch calls findInPage with forward:false and findNext:false for new search text', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'world', 'backward');
  expect(pageContent.findInPage).toHaveBeenCalledWith('world', {
    forward: false,
    findNext: false,
    matchCase: true,
  });
});

test('executeSearch calls findInPage with findNext:true when the same text is searched again', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'hello', 'forward');
  find.executeSearch(pageContent, 'hello', 'backward');
  expect(pageContent.findInPage).toHaveBeenLastCalledWith('hello', {
    forward: false,
    findNext: true,
    matchCase: true,
  });
});

test('enableSearch is only called once across multiple executeSearch calls', () => {
  const pageContent = makePageContent();
  find.executeSearch(pageContent, 'first', 'forward');
  find.executeSearch(pageContent, 'second', 'forward');
  // pageContent.on should be called only once (from the first enableSearch invocation).
  expect(pageContent.on).toHaveBeenCalledTimes(1);
});
