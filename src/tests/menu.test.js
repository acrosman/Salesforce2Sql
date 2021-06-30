const menu = require('../menu');

test('Validate menu template', () => {
  if (process.platform === 'darwin') {
    expect(menu.menuTemplate).toHaveLength(4);
  } else {
    expect(menu.menuTemplate).toHaveLength(3);
  }
});
