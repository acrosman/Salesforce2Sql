// Preload script.
const { contextBridge, ipcRenderer, remote } = require('electron');  // eslint-disable-line

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // Approved channels
      const validChannels = [];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      } else {
        console.error('Invalid message sent by console');
      }
    },
    receive: (channel, func) => {
      const validChannels = ['log_message'];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      } else {
        console.error('Invalid message sent to console');
      }
    },
  },
);
