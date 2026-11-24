import type { MusicPlayerAppElement } from '@/types/music-player-app-element';

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
  if (isHistoryPath(pathname)) return 'historique';
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

export const HISTORY_BROWSE_ID = 'FEmusic_history';
export const HISTORY_PATH = '/history';

export function isHistoryPath(pathname: string): boolean {
  return /^\/(?:history|browse\/FEmusic_history)\/?$/.test(pathname);
}

const HISTORY_LINK = 'a[data-ytmd-history-link]';

function entryLabel(entry: HTMLElement): string {
  return normalizeSidebarLabel(
    entry.querySelector<HTMLElement>('#title, .title, yt-formatted-string')
      ?.textContent ?? entry.textContent ?? '',
  );
}

function entryPath(entry: HTMLElement): string {
  const href = entry.querySelector('a[href]')?.getAttribute('href');
  if (!href) return '';
  try {
    const url = new URL(href, 'https://music.youtube.com');
    return url.origin === 'https://music.youtube.com' ? url.pathname : '';
  } catch {
    return '';
  }
}

function isLibraryEntry(entry: HTMLElement): boolean {
  return /^(?:bibliothèque|library)$/.test(entryLabel(entry)) ||
    /^\/(?:library|browse\/FEmusic_library_landing)\/?$/.test(entryPath(entry));
}

function isHistoryEntry(entry: HTMLElement): boolean {
  return /^(?:historique|history)$/.test(entryLabel(entry)) ||
    isHistoryPath(entryPath(entry));
}

/** Native browse navigation uses the currently signed-in YouTube account.
 * The link remains usable if YouTube changes its internal navigate method.
 */
function createHistoryLink(doc: Document): HTMLAnchorElement {
  const link = doc.createElement('a');
  link.setAttribute('data-ytmd-history-link', '');
  link.href = HISTORY_PATH;
  const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.1 5L6.7 18.4A9 9 0 1 0 13 3Zm-1 4v6l5 3 1-1.7-4-2.3V7Z');
  path.setAttribute('fill', 'currentColor');
  icon.appendChild(path);
  const title = doc.createElement('span');
  title.textContent = 'Historique';
  link.append(icon, title);
  link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
      event.metaKey || event.shiftKey || event.altKey) return;
    const app = doc.querySelector<MusicPlayerAppElement>('ytmusic-app');
    if (typeof app?.navigate !== 'function') return;
    try {
      app.navigate(HISTORY_BROWSE_ID);
      event.preventDefault();
    } catch {
      // Let the native URL handle navigation if the internal method fails.
    }
  });
  return link;
}

export function ensureHistoryLinks(doc: Document, entries: HTMLElement[], pathname: string): void {
  const parents = new Set<HTMLElement>();
  for (const library of entries.filter(isLibraryEntry)) {
    const parent = library.parentElement;
    if (!parent || parents.has(parent)) continue;
    parents.add(parent);
    const links = Array.from(parent.querySelectorAll<HTMLAnchorElement>(HISTORY_LINK))
      .filter((link) => link.parentElement === parent);
    if (entries.some((entry) => entry.parentElement === parent && isHistoryEntry(entry))) {
      links.forEach((link) => link.remove());
      continue;
    }
    const link = links[0] ?? createHistoryLink(doc);
    links.slice(1).forEach((duplicate) => duplicate.remove());
    if (library.nextElementSibling !== link) library.after(link);
    if (isHistoryPath(pathname)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(HISTORY_LINK)) {
    if (!link.parentElement || !parents.has(link.parentElement)) link.remove();
  }
}

const GUIDE_SELECTOR =
  '#guide ytmusic-guide-entry-renderer, #guide-wrapper ytmusic-guide-entry-renderer, ytmusic-guide-renderer ytmusic-guide-entry-renderer';

export function polishSidebar(doc: Document, pathname: string): void {
  const entries = Array.from(doc.querySelectorAll<HTMLElement>(GUIDE_SELECTOR));
  ensureHistoryLinks(doc, entries, pathname);
  const labels = entries.map(entryLabel);

  entries.forEach((entry, index) => {
    entry.toggleAttribute(
      'data-ytmd-subscribe-hidden',
      isSubscribeGuideItem(labels[index]),
    );
    entry.removeAttribute('data-ytmd-active-nav');
  });

  const routeLabel = preferredSidebarLabel(pathname);
  let activeIndex = isHistoryPath(pathname)
    ? entries.findIndex(isHistoryEntry)
    : routeLabel === 'bibliothèque'
      ? entries.findIndex(isLibraryEntry)
      : routeLabel
        ? labels.findIndex((label) => label === routeLabel ||
          (routeLabel === 'accueil' && label === 'home') ||
          (routeLabel === 'explorer' && label === 'explore'))
        : -1;

  if (activeIndex < 0 && !isHistoryPath(pathname)) {
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
  let frame: number | undefined;
  const refresh = () => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
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
    if (frame !== undefined) cancelAnimationFrame(frame);
    window.removeEventListener('popstate', onRoute);
    window.removeEventListener('yt-navigate-finish', onRoute);
  };
}
