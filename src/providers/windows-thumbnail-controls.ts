import NextIcon from '@assets/media-icons-white/next.png?asset&asarUnpack';
import PauseIcon from '@assets/media-icons-white/pause.png?asset&asarUnpack';
import PlayIcon from '@assets/media-icons-white/play.png?asset&asarUnpack';
import PreviousIcon from '@assets/media-icons-white/previous.png?asset&asarUnpack';
import { nativeImage, type BrowserWindow } from 'electron';

import { getSongControls } from '@/providers/song-controls';
import { registerCallback, SongInfoEvent } from '@/providers/song-info';

/**
 * Contrôles natifs de la miniature Windows : ils ne modifient ni les plugins
 * ni le lecteur. La barre d'outils est gérée par Windows, pas par du CSS.
 */
export const setupWindowsThumbnailControls = (win: BrowserWindow): void => {
  if (process.platform !== 'win32') return;

  const previousIcon = nativeImage.createFromPath(PreviousIcon).resize({ width: 16, height: 16 });
  const playIcon = nativeImage.createFromPath(PlayIcon).resize({ width: 16, height: 16 });
  const pauseIcon = nativeImage.createFromPath(PauseIcon).resize({ width: 16, height: 16 });
  const nextIcon = nativeImage.createFromPath(NextIcon).resize({ width: 16, height: 16 });

  if ([previousIcon, playIcon, pauseIcon, nextIcon].some((icon) => icon.isEmpty())) {
    console.warn('[YT Music] Icônes de la miniature Windows indisponibles.');
    return;
  }

  const { previous, playPause, next } = getSongControls(win);
  let currentPlaybackState = false;
  let appliedPlaybackState: boolean | undefined;

  const updateButtons = (playing: boolean, force = false) => {
    currentPlaybackState = playing;
    if (win.isDestroyed() || (!force && appliedPlaybackState === playing)) return;

    // La position et le nombre de boutons restent fixes ; seul Lecture/Pause
    // change en fonction de l'état réel envoyé par le lecteur.
    try {
      const applied = win.setThumbarButtons([
        {
          icon: previousIcon,
          tooltip: 'Précédent',
          click: previous,
        },
        {
          icon: playing ? pauseIcon : playIcon,
          tooltip: playing ? 'Pause' : 'Lecture',
          click: playPause,
        },
        {
          icon: nextIcon,
          tooltip: 'Suivant',
          click: next,
        },
      ]);
      if (applied) appliedPlaybackState = playing;
    } catch (error) {
      console.warn('[YT Music] Mini-commandes Windows indisponibles :', error);
    }
  };

  updateButtons(false);
  // Réessayer quand Windows a créé l'aperçu, sans rouvrir la fenêtre.
  win.once('ready-to-show', () => updateButtons(currentPlaybackState, true));

  registerCallback((songInfo, event) => {
    if (win.isDestroyed() || event === SongInfoEvent.TimeChanged) return;
    if (typeof songInfo.isPaused === 'boolean') {
      updateButtons(!songInfo.isPaused);
    }
  });
};
