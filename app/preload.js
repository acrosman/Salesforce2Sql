// Preload script.
const { contextBridge, ipcRenderer } = require('electron');  // eslint-disable-line
const { handlers } = require('../src/sf_calls');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api',
  {
    send: (channel, data) => {
      // List channels to allow.
      const validChannels = Object.getOwnPropertyNames(handlers);
      validChannels.push('get_preferences');
      validChannels.push('find_text');
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = [
        'current_preferences',
        'log_message',
        'response_db_generated',
        'response_login',
        'response_logout',
        'response_error',
        'response_list_objects',
        'response_schema',
        'response_sqlite3_file',
        'start_find',
        'update_loader',
      ];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
