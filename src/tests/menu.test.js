const menu = require('../menu');

test('Validate menu template', () => {
  expect(menu.menuTemplate.length).toBe(4);
});
