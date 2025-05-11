const mockWindow = {
  webContents: {
    send: jest.fn(),
  },
};

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({
    filePaths: ['/path/to/file'],
    canceled: false,
  }),
  showSaveDialog: jest.fn().mockResolvedValue({
    filePath: '/path/to/save/file',
    canceled: false,
  }),
};

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getAppPath: jest.fn().mockReturnValue('/app/path'),
    getPath: jest.fn().mockReturnValue('/path'),
    getName: jest.fn().mockReturnValue('appName'),
  },
  BrowserWindow: jest.fn().mockReturnValue(mockWindow),
  dialog: mockDialog,
  ipcMain: {
    on: jest.fn(),
    send: jest.fn(),
  },
  mainWindow: mockWindow,
};
