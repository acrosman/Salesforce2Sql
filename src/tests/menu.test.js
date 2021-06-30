const menu = require('../menu');

test('Validate menu template', () => {
  if (process.platform == 'darwin') {
    expect(menu.menuTemplate.length).toBe(4);
  } else {
    expect(menu.menuTemplate.length).toBe(3);
  }
});
