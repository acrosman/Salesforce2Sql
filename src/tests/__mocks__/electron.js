const mockWindow = {
  webContents: {
    send: jest.fn(),
    findInPage: jest.fn(),
    stopFindInPage: jest.fn(),
  },
};

const mockDialogOpenCanceled = { filePaths: [], canceled: true };
const mockDialogSaveCanceled = { filePath: undefined, canceled: true };

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({
    filePaths: ['src/tests/sampleSObjectDescribes.json'],
    canceled: false,
  }),
  showSaveDialog: jest.fn().mockResolvedValue({
    filePath: 'path/to/save/file',
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
    isPackaged: false,
  },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      workAreaSize: { width: 1280, height: 800 },
    }),
  },
  BrowserWindow: jest.fn().mockReturnValue(mockWindow),
  dialog: mockDialog,
  mockDialogOpenCanceled,
  mockDialogSaveCanceled,
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
    send: jest.fn(),
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(true),
  },
  mainWindow: mockWindow,
};
