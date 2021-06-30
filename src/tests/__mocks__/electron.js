/* global jest */

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: {
    getAppPath: jest.fn().mockReturnValue('/app/path'),
    getPath: jest.fn().mockReturnValue('/path'),
    getName: jest.fn().mockReturnValue('appName'),
  },
  dialog: jest.fn(),
};
