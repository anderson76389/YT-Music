import { hasRelevantMutation } from './relevant-mutations';

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
function syncHistoryGeometry(doc: Document, library: HTMLElement, link: HTMLAnchorElement): void {
  const row = library.querySelector<HTMLElement>('tp-yt-paper-item, a[href]') ?? library;
  const title = row.querySelector<HTMLElement>('#title, .title, yt-formatted-string');
  const icon = row.querySelector<HTMLElement>('yt-icon, iron-icon, svg');
  const parent = library.parentElement;
  const view = doc.defaultView;
  if (!parent || !view) return;

  const rect = row.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const iconRect = icon?.getBoundingClientRect();
  const titleRect = title?.getBoundingClientRect();
  // The collapsed guide has a narrow, vertically stacked native item.
  // Use the actual native row, not the overall window width (the hamburger
  // can collapse the guide even in a maximized window).
  const compact = rect.width <= 96 ||
    (!!iconRect && !!titleRect && iconRect.height > 0 &&
      titleRect.height > 0 && titleRect.top >= iconRect.bottom - 2);
  link.toggleAttribute('data-ytmd-history-compact', compact);
  const style = view.getComputedStyle(row);
  const titleStyle = title ? view.getComputedStyle(title) : style;
  const values: Record<string, string> = {
    '--ytmd-history-height': `${rect.height}px`,
    '--ytmd-history-width': `${rect.width}px`,
    '--ytmd-history-left': `${Math.max(0, rect.left - parentRect.left)}px`,
    '--ytmd-history-right': `${Math.max(0, parentRect.right - rect.right)}px`,
    '--ytmd-history-font-size': titleStyle.fontSize || (compact ? '10px' : '16px'),
    '--ytmd-history-font-weight': titleStyle.fontWeight || '500',
    '--ytmd-history-radius': style.borderRadius || '8px',
  };
  if (iconRect && iconRect.width > 0) {
    values['--ytmd-history-icon-size'] = `${iconRect.width}px`;
    values['--ytmd-history-padding'] = compact ? '0px' : `${Math.max(0, iconRect.left - rect.left)}px`;
    values['--ytmd-history-gap'] = titleRect
      ? `${Math.max(0, compact ? titleRect.top - iconRect.bottom : titleRect.left - iconRect.right)}px`
      : compact ? '4px' : '20px';
  } else {
    values['--ytmd-history-padding'] = compact ? '0px' : '16px';
    values['--ytmd-history-gap'] = compact ? '4px' : '20px';
  }
  for (const [key, value] of Object.entries(values)) {
    if (link.style.getPropertyValue(key) !== value) link.style.setProperty(key, value);
  }
}

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
  link.setAttribute('aria-label', 'Historique');
  link.title = 'Historique';
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
    syncHistoryGeometry(doc, library, link);
    if (isHistoryPath(pathname)) {
      if (link.getAttribute('aria-current') !== 'page') link.setAttribute('aria-current', 'page');
    } else if (link.hasAttribute('aria-current')) link.removeAttribute('aria-current');
  }
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(HISTORY_LINK)) {
    if (!link.parentElement || !parents.has(link.parentElement)) link.remove();
  }
}

const GUIDE_SELECTOR =
  '#guide ytmusic-guide-entry-renderer, #guide-wrapper ytmusic-guide-entry-renderer, ytmusic-guide-renderer ytmusic-guide-entry-renderer, ytmusic-mini-guide-renderer ytmusic-mini-guide-entry-renderer, #mini-guide ytmusic-guide-entry-renderer';

export function polishSidebar(doc: Document, pathname: string): void {
  const entries = Array.from(doc.querySelectorAll<HTMLElement>(GUIDE_SELECTOR));
  ensureHistoryLinks(doc, entries, pathname);
  const labels = entries.map(entryLabel);

  entries.forEach((entry, index) => {
    entry.toggleAttribute(
      'data-ytmd-subscribe-hidden',
      isSubscribeGuideItem(labels[index]),
    );
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

  entries.forEach((entry, index) => {
    entry.toggleAttribute('data-ytmd-active-nav', index === activeIndex);
  });
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
  const observed = new Set<Element>();
  const resizeObserver = new ResizeObserver(() => refresh());
  const syncObservedRows = () => {
    const next = new Set<Element>();
    for (const library of doc.querySelectorAll<HTMLElement>(GUIDE_SELECTOR)) {
      if (!isLibraryEntry(library)) continue;
      next.add(library);
      next.add(library.querySelector('tp-yt-paper-item, a[href]') ?? library);
    }
    for (const row of observed) {
      if (!next.has(row)) {
        resizeObserver.unobserve(row);
        observed.delete(row);
      }
    }
    for (const row of next) {
      if (!observed.has(row)) {
        resizeObserver.observe(row);
        observed.add(row);
      }
    }
  };
  const refresh = () => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      polishSidebar(doc, window.location.pathname);
      hideNativeLyricsTab(doc);
      syncObservedRows();
    });
  };

  refresh();
  // Les nouveaux éléments sont ajoutés par YouTube Music lors des navigations.
  // Éviter d'observer les attributs pour ne pas boucler sur nos propres marqueurs.
  const selector = '#guide, #guide-wrapper, ytmusic-guide-renderer, #mini-guide, ytmusic-mini-guide-renderer, ytmusic-player-page #tabs';
  const observer = new MutationObserver((records) => {
    if (hasRelevantMutation(records, selector)) refresh();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const onRoute = () => refresh();
  window.addEventListener('resize', onRoute);
  window.addEventListener('popstate', onRoute);
  window.addEventListener('yt-navigate-finish', onRoute);
  return () => {
    observer.disconnect();
    resizeObserver.disconnect();
    observed.clear();
    if (frame !== undefined) cancelAnimationFrame(frame);
    window.removeEventListener('resize', onRoute);
    window.removeEventListener('popstate', onRoute);
    window.removeEventListener('yt-navigate-finish', onRoute);
  };
}
