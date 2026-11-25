import { join } from 'node:path';

import MiniPlayerHtml from '@assets/mini-player.html?asset';
import { BrowserWindow, ipcMain } from 'electron';

import { getSongControls } from './song-controls';
import { registerCallback, SongInfoEvent } from './song-info';
import { normalizeMiniVolume, type MiniPlayerState } from './mini-player-state';

const openers = new WeakMap<BrowserWindow, () => BrowserWindow>();

export function openMiniPlayer(main: BrowserWindow): BrowserWindow | undefined {
  return openers.get(main)?.();
}

export function setupMiniPlayer(main: BrowserWindow): void {
  let mini: BrowserWindow | null = null;
  let ready = false;
  let artwork: Electron.NativeImage | null = null;
  let artworkDirty = false;
  const state: MiniPlayerState = {
    title: '', artist: '', cover: '', playing: false, volume: null, muted: false,
  };
  const publish = () => {
    if (ready && mini && !mini.isDestroyed()) {
      if (artworkDirty) {
        state.cover = artwork && !artwork.isEmpty()
          ? artwork.resize({ width: 144 }).toDataURL() : '';
        artworkDirty = false;
      }
      mini.webContents.send('ytmd:mini-state', state);
    }
  };
  const requestState = () => {
    if (!main.isDestroyed() && !main.webContents.isDestroyed()) {
      main.webContents.send('ytmd:mini-request-state');
    }
  };
  const controls = getSongControls(main);
  const unsubscribe = registerCallback((song, event) => {
    if (event !== SongInfoEvent.VideoSrcChanged) return;
    state.title = song.title;
    state.artist = song.artist;
    artwork = song.image ?? null;
    artworkDirty = true;
    publish();
  });
  const onPlayerState = (event: Electron.IpcMainEvent, playing: unknown, volume: unknown, muted: unknown) => {
    if (main.isDestroyed() || event.sender !== main.webContents ||
        typeof playing !== 'boolean' || typeof muted !== 'boolean') return;
    const normalized = normalizeMiniVolume(volume);
    if (normalized === null) return;
    if (state.playing === playing && state.volume === normalized && state.muted === muted) return;
    state.playing = playing;
    state.volume = normalized;
    state.muted = muted;
    publish();
  };
  const onCommand = (event: Electron.IpcMainEvent, command: unknown, value: unknown) => {
    if (!mini || mini.isDestroyed() || event.sender !== mini.webContents || main.isDestroyed()) return;
    switch (command) {
      case 'ready':
        ready = true;
        publish();
        requestState();
        break;
      case 'close':
        mini.close();
        break;
      case 'previous':
        controls.previous();
        break;
      case 'play':
        controls.playPause();
        break;
      case 'next':
        controls.next();
        break;
      case 'volume': {
        const volume = normalizeMiniVolume(value);
        if (volume !== null) controls.setVolume(volume);
        break;
      }
      default:
        break;
    }
  };
  ipcMain.on('ytmd:mini-command', onCommand);
  ipcMain.on('ytmd:mini-player-state', onPlayerState);

  openers.set(main, () => {
    if (mini && !mini.isDestroyed()) {
      mini.show();
      mini.focus();
      requestState();
      return mini;
    }
    ready = false;
    const window = new BrowserWindow({
      width: 300,
      height: 236,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#171719',
      title: 'YT Music — Mini-lecteur',
      webPreferences: {
        preload: join(__dirname, '..', 'preload', 'mini-player.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: 'ytmd-mini-player-local',
      },
    });
    mini = window;
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('preload-error', (_event, file, error) => {
      console.error('[YT Music] Mini-player preload failed', file, error);
    });
    window.once('ready-to-show', () => {
      if (!window.isDestroyed()) window.show();
    });
    window.on('closed', () => {
      if (mini === window) {
        mini = null;
        ready = false;
        state.cover = '';
        artworkDirty = true;
      }
    });
    void window.loadFile(MiniPlayerHtml).catch((error: unknown) => {
      console.error('[YT Music] Mini-lecteur indisponible', error);
      if (!window.isDestroyed()) window.close();
    });
    return window;
  });

  main.once('closed', () => {
    unsubscribe();
    openers.delete(main);
    ipcMain.removeListener('ytmd:mini-command', onCommand);
    ipcMain.removeListener('ytmd:mini-player-state', onPlayerState);
    if (mini && !mini.isDestroyed()) mini.destroy();
  });
}
