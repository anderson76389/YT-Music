import NextIcon from '@assets/media-icons-white/next.png?asset&asarUnpack';
import PauseIcon from '@assets/media-icons-white/pause.png?asset&asarUnpack';
import PlayIcon from '@assets/media-icons-white/play.png?asset&asarUnpack';
import PreviousIcon from '@assets/media-icons-white/previous.png?asset&asarUnpack';
import { nativeImage, type BrowserWindow } from 'electron';

import { getSongControls } from '@/providers/song-controls';
import { registerCallback, SongInfoEvent } from '@/providers/song-info';

/**
 * Windows thumbnail-toolbar controls. Explorer cannot reliably register the
 * thumbar before the window is visible, so install on 'show' and retry only
 * a few times if Windows reports that it is not ready yet.
 *
 * Uses the existing player commands and never changes plugins or playback.
 */
export const setupWindowsThumbnailControls = (win: BrowserWindow): void => {
  if (process.platform !== 'win32') return;

  const previousIcon = nativeImage.createFromPath(PreviousIcon).resize({ width: 16, height: 16 });
  const playIcon = nativeImage.createFromPath(PlayIcon).resize({ width: 16, height: 16 });
  const pauseIcon = nativeImage.createFromPath(PauseIcon).resize({ width: 16, height: 16 });
  const nextIcon = nativeImage.createFromPath(NextIcon).resize({ width: 16, height: 16 });

  if ([previousIcon, playIcon, pauseIcon, nextIcon].some((icon) => icon.isEmpty())) {
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
      const success = win.setThumbarButtons([
        {
          icon: previousIcon,
          tooltip: 'Précédent',
          click: previous,
        },
        {
          icon: isPlaying ? pauseIcon : playIcon,
          tooltip: isPlaying ? 'Pause' : 'Lecture',
          click: playPause,
        },
        {
          icon: nextIcon,
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

  const onWindowShown = () => {
    retries = 0;
    cancelRetry();
    // Reapply even if Windows recreated the preview after minimizing/hiding.
    applyButtons(true);
  };

  win.on('show', onWindowShown);
  win.on('restore', onWindowShown);
  win.on('focus', () => {
    if (!registered) applyButtons();
  });
  win.on('closed', cancelRetry);

  registerCallback((songInfo, event) => {
    if (win.isDestroyed() || event === SongInfoEvent.TimeChanged) return;
    if (typeof songInfo.isPaused !== 'boolean') return;

    isPlaying = !songInfo.isPaused;
    applyButtons();
  });

  // The window may already be showing when the provider is initialized.
  if (win.isVisible()) onWindowShown();
};
