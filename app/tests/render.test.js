/**
 * @jest-environment jsdom
*/

beforeAll(() => {
  global.$ = require('../../node_modules/jquery/dist/jquery.min');
  global.window = window;
  global.window.api = {
    receive: jest.fn(),
    send: jest.fn(),
  };
});

beforeEach(() => {
  // Load index.html since render.js assumes it's structures.
  const fs = require('fs');
  const indexHtml = fs.readFileSync('app/tests/minIndex.html');
  document.body.innerHTML = indexHtml.toString();
});

test('Test Replace Text', () => {

  const render = require('../render');
  const replaceText = render.__get__('replaceText');
  replaceText('consoleModalLabel', 'Bar');
  expect(document.getElementById('consoleModalLabel').innerText).toEqual('Bar');
});
