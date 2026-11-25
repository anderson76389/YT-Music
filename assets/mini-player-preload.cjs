'use strict';

// A sandboxed Electron preload can require electron, but not another local
// bundle. Ship this small script verbatim, independent of the main preload.
const { contextBridge, ipcRenderer } = require('electron');
const commands = new Set(['close', 'previous', 'play', 'next', 'volume']);

contextBridge.exposeInMainWorld('miniPlayer', {
  command(command, value) {
    if (!commands.has(command)) return;
    if (command === 'volume') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      ipcRenderer.send('ytmd:mini-command', command, Math.max(0, Math.min(100, value)));
    } else {
      ipcRenderer.send('ytmd:mini-command', command);
    }
  },
  onState(listener) {
    if (typeof listener !== 'function') return;
    ipcRenderer.on('ytmd:mini-state', (_event, state) => listener(state));
    ipcRenderer.send('ytmd:mini-command', 'ready');
  },
});
