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

export function polishSidebar(doc: Document, pathname: string): void {
  const entries = Array.from(doc.querySelectorAll<HTMLElement>(GUIDE_SELECTOR));
  const labels = entries.map((entry) =>
    normalizeSidebarLabel(
      entry.querySelector<HTMLElement>('#title, .title, yt-formatted-string')
        ?.textContent ?? entry.textContent ?? '',
    ),
  );

  entries.forEach((entry, index) => {
    entry.toggleAttribute(
      'data-ytmd-subscribe-hidden',
      isSubscribeGuideItem(labels[index]),
    );
    entry.removeAttribute('data-ytmd-active-nav');
  });

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

  if (activeIndex >= 0) {
    entries[activeIndex].setAttribute('data-ytmd-active-nav', '');
  }
}

/** Masquer uniquement l'onglet natif « Paroles » de la page de lecture.
 * Les autres onglets, contenus et commandes YouTube Music restent intacts.
 */
export function isNativeLyricsTabLabel(value: string): boolean {
  return /^(?:paroles|lyrics)$/i.test(value.trim().replace(/\s+/g, ' '));
}

export function hideNativeLyricsTab(doc: Document): void {
  const tabs = doc.querySelectorAll<HTMLElement>(
    'ytmusic-player-page #tabs tp-yt-paper-tab, ytmusic-player-page #tabs yt-tab-shape',
  );
  for (const tab of tabs) {
    const label = (
      tab.querySelector<HTMLElement>('#tab-title, .tab-title, yt-formatted-string')
        ?.textContent ?? tab.textContent ?? ''
    ).trim();
    if (isNativeLyricsTabLabel(label)) {
      tab.style.setProperty('display', 'none', 'important');
    }
  }
}

export function setupSidebarPolish(doc: Document = document): () => void {
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      polishSidebar(doc, window.location.pathname);
      hideNativeLyricsTab(doc);
    });
  };

  refresh();
  // Les nouveaux éléments sont ajoutés par YouTube Music lors des navigations.
  // Éviter d'observer les attributs pour ne pas boucler sur nos propres marqueurs.
  const observer = new MutationObserver(refresh);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const onRoute = () => refresh();
  window.addEventListener('popstate', onRoute);
  window.addEventListener('yt-navigate-finish', onRoute);
  return () => {
    observer.disconnect();
    window.removeEventListener('popstate', onRoute);
    window.removeEventListener('yt-navigate-finish', onRoute);
  };
}
