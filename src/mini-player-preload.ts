import { contextBridge, ipcRenderer } from 'electron';

import type { MiniPlayerState } from './providers/mini-player-state';

contextBridge.exposeInMainWorld('miniPlayer', {
  command: (command: string, value?: number) => ipcRenderer.send('ytmd:mini-command', command, value),
  onState: (listener: (state: MiniPlayerState) => void) => {
    ipcRenderer.on('ytmd:mini-state', (_event, state: MiniPlayerState) => listener(state));
    ipcRenderer.send('ytmd:mini-command', 'ready');
  },
});
