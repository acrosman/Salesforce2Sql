// Preload script.
const { contextBridge, ipcRenderer, remote } = require('electron');  // eslint-disable-line
const { handlers } = require('../src/sf_calls.js');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // List channels to allow.
      const validChannels = Object.getOwnPropertyNames(handlers);
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = [
        'response_login',
        'response_logout',
        'response_generic',
      ];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
