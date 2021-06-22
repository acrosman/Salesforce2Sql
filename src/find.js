const { BrowserWindow } = require('electron');  // eslint-disable-line

let currentSearchReference;
let currentSearchText;
let searchEnabled = false;

const enableSearch = (pageContent) => {
  pageContent.on('found-in-page', (event, result) => {
    pageContent.send('log_message', 'Info', `Found ${result.matches} for ${currentSearchText}`);
    if (result.finalUpdate) {
      pageContent.stopFindInPage('keepSelection');
      currentSearchText = null;
      currentSearchReference = null;
    }
  });
  searchEnabled = true;
};

/**
 * executeSearch: Searches provided content for requested text.
 * @param {*} pageContent: The content of the window to Search.
 * @param {*} searchText: The text to search for.
 */
const executeSearch = (pageContent, searchText) => {
  if (!searchEnabled) {
    enableSearch(pageContent);
  }
  // If there is no active search, or this is new text, start a search.
  if (currentSearchText !== searchText.text || !currentSearchReference) {
    currentSearchText = searchText.text;
    pageContent.send('log_message', {
      sender: 'Find',
      channel: 'Info',
      message: `Starting search for ${currentSearchText}`,
    });
    currentSearchReference = pageContent.findInPage(currentSearchText, {
      forward: true,
      findNext: false,
      matchCase: true,
    });
  } else {
    currentSearchReference = pageContent.findInPage(currentSearchText, {
      forward: true,
      findNext: true,
      matchCase: true,
    });
  }
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
