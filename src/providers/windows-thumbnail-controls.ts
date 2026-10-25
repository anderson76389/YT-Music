import NextIconBlack from '@assets/media-icons-black/next.png?asset&asarUnpack';
import PauseIconBlack from '@assets/media-icons-black/pause.png?asset&asarUnpack';
import PlayIconBlack from '@assets/media-icons-black/play.png?asset&asarUnpack';
import PreviousIconBlack from '@assets/media-icons-black/previous.png?asset&asarUnpack';
import NextIcon from '@assets/media-icons-white/next.png?asset&asarUnpack';
import PauseIcon from '@assets/media-icons-white/pause.png?asset&asarUnpack';
import PlayIcon from '@assets/media-icons-white/play.png?asset&asarUnpack';
import PreviousIcon from '@assets/media-icons-white/previous.png?asset&asarUnpack';
import { ipcMain, nativeImage, nativeTheme, type BrowserWindow } from 'electron';

import { getSongControls } from '@/providers/song-controls';
import { registerCallback, SongInfoEvent } from '@/providers/song-info';

// Il ne doit y avoir qu'un seul propriétaire de setThumbarButtons.
// Le plugin optionnel règle la couleur des icônes sans recréer les boutons.
const themeAwareWindows = new WeakSet<BrowserWindow>();
const refreshers = new WeakMap<BrowserWindow, () => void>();

export const setWindowsThumbnailThemeAware = (
  win: BrowserWindow,
  enabled: boolean,
): void => {
  if (enabled) themeAwareWindows.add(win);
  else themeAwareWindows.delete(win);
  refreshers.get(win)?.();
};

/**
 * Windows thumbnail-toolbar controls. Explorer cannot reliably register the
 * thumbar before the window is visible, so install on 'show' and retry only
 * a few times if Windows reports that it is not ready yet.
 *
 * Uses the existing player commands and never changes plugins or playback.
 */
export const setupWindowsThumbnailControls = (win: BrowserWindow): void => {
  if (process.platform !== 'win32') return;

  const makeIcons = (previous: string, play: string, pause: string, next: string) => ({
    previous: nativeImage.createFromPath(previous).resize({ width: 16, height: 16 }),
    play: nativeImage.createFromPath(play).resize({ width: 16, height: 16 }),
    pause: nativeImage.createFromPath(pause).resize({ width: 16, height: 16 }),
    next: nativeImage.createFromPath(next).resize({ width: 16, height: 16 }),
  });
  const whiteIcons = makeIcons(PreviousIcon, PlayIcon, PauseIcon, NextIcon);
  const blackIcons = makeIcons(PreviousIconBlack, PlayIconBlack, PauseIconBlack, NextIconBlack);

  if ([...Object.values(whiteIcons), ...Object.values(blackIcons)].some((icon) => icon.isEmpty())) {
    console.warn('[YT Music] Impossible de charger les icônes des contrôles Windows.');
    return;
  }

  const { previous, playPause, next } = getSongControls(win);
  let isPlaying = false;
  let appliedState: boolean | undefined;
  let registered = false;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelRetry = () => {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  };

  const applyButtons = (force = false) => {
    if (win.isDestroyed() || !win.isVisible()) return;
    if (!force && registered && appliedState === isPlaying) return;

    try {
      // Icônes blanches par défaut. Le plugin optionnel permet d'adapter
      // les icônes au thème système, sans créer de second gestionnaire.
      const icons =
        themeAwareWindows.has(win) && !nativeTheme.shouldUseDarkColors
          ? blackIcons
          : whiteIcons;
      const success = win.setThumbarButtons([
        {
          icon: icons.previous,
          tooltip: 'Précédent',
          click: previous,
        },
        {
          icon: isPlaying ? icons.pause : icons.play,
          tooltip: isPlaying ? 'Pause' : 'Lecture',
          click: onPlayPauseClick,
        },
        {
          icon: icons.next,
          tooltip: 'Suivant',
          click: next,
        },
      ]);

      if (success) {
        registered = true;
        appliedState = isPlaying;
        retries = 0;
        cancelRetry();
        return;
      }
    } catch (error) {
      console.warn('[YT Music] Erreur des contrôles de miniature Windows :', error);
    }

    // Windows 11 may not expose its taskbar button until after the show event.
    // A bounded retry avoids interfering with playback or consuming resources.
    if (retryTimer === undefined && retries < 5) {
      retries += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        applyButtons(true);
      }, 600);
    } else if (retries >= 5) {
      console.warn('[YT Music] Barre de miniature non disponible sur cette fenêtre Windows.');
    }
  };

  // Windows draws native thumbnail buttons; it cannot animate their shape.
  // Show the new glyph immediately after a click and let the actual player
  // event confirm or correct the state, avoiding a stale play/pause icon.
  const onPlayPauseClick = () => {
    if (win.isDestroyed()) return;
    playPause();
    // Instantané même avant les métadonnées, puis confirmé par le média.
    isPlaying = !isPlaying;
    applyButtons();
  };

  const onWindowShown = () => {
    retries = 0;
    cancelRetry();
    // Reapply even if Windows recreated the preview after minimizing/hiding.
    applyButtons(true);
    // Le renderer peut s'être initialisé avant l'inscription IPC du processus
    // principal : redemander l'état réel à chaque affichage de la fenêtre.
    if (!win.webContents.isDestroyed()) {
      win.webContents.send('ytmd:request-playback-state');
    }
  };

  win.on('show', onWindowShown);
  win.on('restore', onWindowShown);
  win.on('focus', () => {
    if (!registered) applyButtons();
  });
  const onRendererPlaybackState = (
    event: Electron.IpcMainEvent,
    playing: unknown,
  ) => {
    if (win.isDestroyed() || event.sender !== win.webContents ||
        typeof playing !== 'boolean') return;
    isPlaying = playing;
    applyButtons();
  };
  ipcMain.on('ytmd:taskbar-playback-state', onRendererPlaybackState);

  const onThemeUpdated = () => {
    if (themeAwareWindows.has(win)) applyButtons(true);
  };
  nativeTheme.on('updated', onThemeUpdated);

  refreshers.set(win, () => applyButtons(true));
  win.on('closed', () => {
    cancelRetry();
    nativeTheme.removeListener('updated', onThemeUpdated);
    refreshers.delete(win);
    themeAwareWindows.delete(win);
    ipcMain.removeListener('ytmd:taskbar-playback-state', onRendererPlaybackState);
  });

  // Une seule routine met à jour les boutons. Les événements réels play/pause
  // servent aussi de secours si le canal IPC du média est indisponible.
  // Ignorer VideoSrcChanged : son champ isPaused peut être inexact.
  registerCallback((songInfo, event) => {
    if (win.isDestroyed() ||
        event !== SongInfoEvent.PlayOrPaused ||
        typeof songInfo.isPaused !== 'boolean') return;

    isPlaying = !songInfo.isPaused;
    applyButtons();
  });

  // The window may already be showing when the provider is initialized.
  if (win.isVisible()) onWindowShown();
};
