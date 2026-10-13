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


/**
 * Les publicités sont déjà détectées sur la classe du lecteur et les événements
 * vidéo. Le MutationObserver global sert seulement à retrouver un lecteur/une
 * vidéo remplacés ou une boîte anti-inactivité ajoutée dans la page.
 */
const RELEVANT_NODES = 'video, #movie_player, ytmusic-you-there-renderer';

function isRelevantAntiPauseNode(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return element.matches(RELEVANT_NODES) ||
    element.querySelector(RELEVANT_NODES) !== null;
}

export function hasRelevantAntiPauseMutation(
  changes: readonly MutationRecord[],
): boolean {
  for (const change of changes) {
    for (const node of change.addedNodes) {
      if (isRelevantAntiPauseNode(node)) return true;
    }
    for (const node of change.removedNodes) {
      if (isRelevantAntiPauseNode(node)) return true;
    }
  }
  return false;
}
