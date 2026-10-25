/**
 * Mise à jour possible même lorsque YT Music est réduit dans la barre Windows.
 * Avant la première installation des boutons, attendre que la fenêtre existe
 * visuellement. Après installation, ne pas exiger win.isVisible().
 */
export const canRefreshThumbnail = (registered: boolean, visible: boolean) =>
  registered || visible;

/** L'API du lecteur fait foi ; le média HTML fournit un repli. */
export const getThumbnailPlayingState = (
  playerState: number | undefined,
  paused: boolean,
  ended: boolean,
): boolean => {
  if (playerState === 1) return true;
  if (playerState === 2 || playerState === 0) return false;
  return !paused && !ended;
};
