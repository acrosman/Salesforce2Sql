const { BrowserWindow, app, Menu } = require('electron');  // eslint-disable-line
const { openPreferences } = require('./preferences');
const { jumpToFind } = require('./find');

const template = [{
  label: 'Edit',
  submenu: [{
    label: 'Undo',
    accelerator: 'CmdOrCtrl+Z',
    role: 'undo',
  }, {
    label: 'Redo',
    accelerator: 'Shift+CmdOrCtrl+Z',
    role: 'redo',
  }, {
    type: 'separator',
  }, {
    label: 'Cut',
    accelerator: 'CmdOrCtrl+X',
    role: 'cut',
  }, {
    label: 'Copy',
    accelerator: 'CmdOrCtrl+C',
    role: 'copy',
  }, {
    label: 'Paste',
    accelerator: 'CmdOrCtrl+V',
    role: 'paste',
  }, {
    label: 'Select All',
    accelerator: 'CmdOrCtrl+A',
    role: 'selectall',
  }, {
    type: 'separator',
  }, {
    label: 'Find Text',
    accelerator: 'CmdOrCtrl+F',
    role: 'find',
    click: jumpToFind,
    id: 'find-menu-item',
  }, {
    type: 'separator',
  }, {
    label: 'Preferences',
    accelerator: 'CmdOrCtrl+,', // shortcut
    click: openPreferences,
  }],
}, {
  label: 'View',
  submenu: [{
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click: (item, focusedWindow) => {
      if (focusedWindow) {
        // on reload, start fresh and close any old
        // open secondary windows
        if (focusedWindow.id === 1) {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (win.id > 1) win.close();
          });
        }
        focusedWindow.reload();
      }
    },
  }, {
    label: 'Toggle Full Screen',
    accelerator: (() => {
      if (process.platform === 'darwin') {
        return 'Ctrl+Command+F';
      }
      return 'F11';
    })(),
    click: (item, focusedWindow) => {
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
      }
    },
  }, {
    label: 'Toggle Developer Tools',
    accelerator: (() => {
      if (process.platform === 'darwin') {
        return 'Alt+Command+I';
      }
      return 'Ctrl+Shift+I';
    })(),
    click: (item, focusedWindow) => {
      if (focusedWindow) {
        focusedWindow.toggleDevTools();
      }
    },
  }],
}, {
  label: 'Window',
  role: 'window',
  submenu: [{
    label: 'Minimize',
    accelerator: 'CmdOrCtrl+M',
    role: 'minimize',
  }, {
    label: 'Close',
    accelerator: 'CmdOrCtrl+W',
    role: 'close',
  }, {
    type: 'separator',
  }, {
    label: 'Reopen Window',
    accelerator: 'CmdOrCtrl+Shift+T',
    enabled: false,
    key: 'reopenMenuItem',
    click: () => {
      app.emit('activate');
    },
  }],
}];

// MacOS menu tweaks.
if (process.platform === 'darwin') {
  const name = app.getName();
  template.unshift({
    label: name,
    submenu: [{
      label: `About ${name}`,
      role: 'about',
    }, {
      type: 'separator',
    }, {
      label: 'Preferences',
      accelerator: 'CmdOrCtrl+,', // shortcut
      click: openPreferences,
    }, {
      type: 'separator',
    }, {
      label: 'Services',
      role: 'services',
      submenu: [],
    }, {
      type: 'separator',
    }, {
      label: `Hide ${name}`,
      accelerator: 'Command+H',
      role: 'hide',
    }, {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers',
    }, {
      label: 'Show All',
      role: 'unhide',
    }, {
      type: 'separator',
    }, {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => {
        app.quit();
      },
    }],
  });

  // Window menu.
  template[3].submenu.push({
    type: 'separator',
  }, {
    label: 'Bring All to Front',
    role: 'front',
  });

  // Remove preferences from Edit menu.
  template[1].submenu.pop();
}

exports.menuTemplate = template;
