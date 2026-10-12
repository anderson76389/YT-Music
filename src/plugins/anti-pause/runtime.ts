/**
 * Anti-inactivité : rafraîchit la valeur d'activité utilisée par YouTube Music.
 * Le fonctionnement du lecteur distant reste dépendant de son implémentation.
 */
export type ActivityTarget = { _lact?: number };

export type ActivityClock = {
  now: () => number;
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (handle: number) => void;
};

export const HEARTBEAT_INTERVAL_MS = 15_000;

export function startIdleHeartbeat(
  target: ActivityTarget,
  clock: ActivityClock,
): () => void {
  const tick = () => {
    target._lact = clock.now();
  };

  tick();
  const id = clock.setInterval(tick, HEARTBEAT_INTERVAL_MS);
  return () => clock.clearInterval(id);
}

export function dismissIdlePrompt(doc: Document): boolean {
  const dialog = doc.querySelector<HTMLElement>('ytmusic-you-there-renderer');
  if (!dialog) return false;

  const confirm = dialog.querySelector<HTMLElement>(
    '#button button, yt-button-renderer button, button, #button, yt-button-renderer',
  );
  if (!confirm) return false;

  confirm.click();

  // Une reprise n'est tentée que lorsqu'une modale d'inactivité est visible.
  const video = doc.querySelector<HTMLVideoElement>('video');
  if (video?.paused) {
    void video.play().catch(() => {
      // L'autoplay peut être interdit par Chromium ou le service.
    });
  }

  return true;
}
