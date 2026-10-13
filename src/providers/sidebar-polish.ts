/** Petits ajustements locaux de la navigation YouTube Music.
 * Ne modifie pas les menus de lecture, les boutons des créateurs ou les plugins.
 */
const SUBSCRIPTION_LABELS = new Set(["s'abonner", 's’abonner']);

export function normalizeSidebarLabel(value: string): string {
  return value.trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
}

export function isSubscribeGuideItem(value: string): boolean {
  return SUBSCRIPTION_LABELS.has(normalizeSidebarLabel(value));
}

export function preferredSidebarLabel(pathname: string): string | null {
  if (pathname === '/' || pathname.startsWith('/browse/FEmusic_home')) {
    return 'accueil';
  }
  if (pathname.startsWith('/explore') || pathname.includes('FEmusic_explore')) {
    return 'explorer';
  }
  if (pathname.startsWith('/library') || pathname.includes('FEmusic_library')) {
    return 'bibliothèque';
  }
  return null;
}

const GUIDE_SELECTOR =
  '#guide ytmusic-guide-entry-renderer, #guide-wrapper ytmusic-guide-entry-renderer, ytmusic-guide-renderer ytmusic-guide-entry-renderer';
const GUIDE_ROOT_SELECTOR = '#guide, #guide-wrapper, ytmusic-guide-renderer';

/** N'inspecter la barre latérale que si la mutation peut la concerner. */
function isGuideNode(node: Node, checkAncestors: boolean): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return element.matches(GUIDE_ROOT_SELECTOR) ||
    (checkAncestors
      ? element.closest(GUIDE_ROOT_SELECTOR) !== null
      : element.querySelector(GUIDE_ROOT_SELECTOR) !== null);
}

export function hasSidebarChange(changes: readonly MutationRecord[]): boolean {
  for (const change of changes) {
    if (isGuideNode(change.target, true)) return true;
    for (const node of change.addedNodes) {
      if (isGuideNode(node, false)) return true;
    }
    for (const node of change.removedNodes) {
      if (isGuideNode(node, false)) return true;
    }
  }
  return false;
}

export function polishSidebar(doc: Document, pathname: string): void {
  const entries = Array.from(doc.querySelectorAll<HTMLElement>(GUIDE_SELECTOR));
  const labels = entries.map((entry) =>
    normalizeSidebarLabel(
      entry.querySelector<HTMLElement>('#title, .title, yt-formatted-string')
        ?.textContent ?? entry.textContent ?? '',
    ),
  );



  const routeLabel = preferredSidebarLabel(pathname);
  let activeIndex = routeLabel
    ? labels.findIndex((label) => label === routeLabel)
    : -1;

  if (activeIndex < 0) {
    // Sur une page de lecture, garder la dernière section marquée sélectionnée
    // par YouTube Music, plutôt que d'éclairer deux boutons à la fois.
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (
        entry.hasAttribute('selected') ||
        entry.querySelector('[selected], [aria-current="page"]')
      ) {
        activeIndex = index;
      }
    }
  }

  // Éviter les écritures DOM et les recalculs CSS si l'état n'a pas changé.
  entries.forEach((entry, index) => {
    const hidden = isSubscribeGuideItem(labels[index]);
    if (entry.hasAttribute('data-ytmd-subscribe-hidden') !== hidden) {
      entry.toggleAttribute('data-ytmd-subscribe-hidden', hidden);
    }
    const selected = index === activeIndex;
    if (entry.hasAttribute('data-ytmd-active-nav') !== selected) {
      entry.toggleAttribute('data-ytmd-active-nav', selected);
    }
  });
}

export function setupSidebarPolish(doc: Document = document): () => void {
  let queued = false;
  let disposed = false;
  let frame: number | undefined;
  const refresh = () => {
    if (queued || disposed) return;
    queued = true;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      queued = false;
      if (!disposed) polishSidebar(doc, window.location.pathname);
    });
  };

  refresh();
  // Les mutations de listes de titres et des lecteurs ne nécessitent pas de
  // rescanner la navigation. Une insertion/reconstruction du guide, oui.
  const observer = new MutationObserver((changes) => {
    if (hasSidebarChange(changes)) refresh();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const onRoute = () => refresh();
  window.addEventListener('popstate', onRoute);
  window.addEventListener('yt-navigate-finish', onRoute);
  return () => {
    disposed = true;
    observer.disconnect();
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    window.removeEventListener('popstate', onRoute);
    window.removeEventListener('yt-navigate-finish', onRoute);
  };
}
