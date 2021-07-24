const menu = require('../menu');

test('Validate menu template size', () => {
  if (process.platform === 'darwin') {
    expect(menu.menuTemplate).toHaveLength(4);
  } else {
    expect(menu.menuTemplate).toHaveLength(3);
  }
});

const getMenu = (menuLabel, menuStructure) => {
  for (let i = 0; i < menuStructure.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(menuStructure[i], 'label')) {
      if (menuStructure[i].label === menuLabel) {
        return menuStructure[i];
      }
    }
  }
  return null;
};

test('Validate Menu has Find & Preferences', () => {
  const editMenu = getMenu('Edit', menu.menuTemplate);
  expect(editMenu).not.toBeNull();
  const findMenuItem = getMenu('Find Text', editMenu.submenu);

  expect(findMenuItem).not.toBeNull();
  expect(findMenuItem).toHaveProperty('accelerator');
  expect(findMenuItem.accelerator).toBe('CmdOrCtrl+F');

  let prefMenuItem;
  if (process.platform !== 'darwin') {
    prefMenuItem = getMenu('Preferences', editMenu.submenu);
  } else {
    const appMenu = getMenu('appName', menu.menuTemplate);
    prefMenuItem = getMenu('Preferences', appMenu.submenu);
  }
  expect(prefMenuItem).not.toBeNull();
  expect(prefMenuItem).toHaveProperty('accelerator');
  expect(prefMenuItem.accelerator).toBe('CmdOrCtrl+,');
});
