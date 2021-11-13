global.$ = require('../../node_modules/jquery/dist/jquery.min');
const render = require('../render');

test('Test Replace Text', () => {
  // Dom Setup
  document.body.innerHTML = '<div id = "testme" > Foo</div>';

  render.replaceText('testme', 'Bar');

  expect(document.getElementById('testme').innerText).toEqual('Bar');
});
