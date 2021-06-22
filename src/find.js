const { BrowserWindow } = require('electron');  // eslint-disable-line

/**
 * executeSearch: Searches provided content for requested text.
 * @param {*} webContents: The content of the window to Search.
 * @param {*} searchText: The text to search for.
 */
const executeSearch = (webContents, searchText) => {
  webContents.findInPage(searchText.text);
};

/**
 * jumpToFind: Moves the window with search to be the active window, and instructs it to active
 *  find controls.
 * @param {*} findWindow: The window with application find controls
 */
const jumpToFind = (item, focusedWindow) => {
  focusedWindow.webContents.send('start_find');
};

exports.executeSearch = executeSearch;
exports.jumpToFind = jumpToFind;
