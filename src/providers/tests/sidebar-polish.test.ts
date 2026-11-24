import { expect, test } from '@playwright/test';
import { Window } from 'happy-dom';

import {
  HISTORY_BROWSE_ID,
  isHistoryPath,
  isNativeLyricsTabLabel,
  polishSidebar,
  isSubscribeGuideItem,
  normalizeSidebarLabel,
  preferredSidebarLabel,
} from '../sidebar-polish';

test('retire exclusivement S’abonner de la navigation principale', () => {
  expect(isSubscribeGuideItem("S'abonner")).toBe(true);
  expect(isSubscribeGuideItem('  S’abonner  ')).toBe(true);
  expect(isSubscribeGuideItem('Bibliothèque')).toBe(false);
  expect(isSubscribeGuideItem('Abonnements')).toBe(false);
  expect(isSubscribeGuideItem('S’abonner à une chaîne')).toBe(false);
});

test('choisit un seul onglet courant selon la route', () => {
  expect(preferredSidebarLabel('/')).toBe('accueil');
  expect(preferredSidebarLabel('/library')).toBe('bibliothèque');
  expect(preferredSidebarLabel('/explore')).toBe('explorer');
  expect(preferredSidebarLabel('/watch?v=123')).toBeNull();
  expect(normalizeSidebarLabel('  BIbliothèque  ')).toBe('bibliothèque');
});

test('masque uniquement le libellé de l’onglet natif des paroles', () => {
  expect(isNativeLyricsTabLabel('PAROLES')).toBe(true);
  expect(isNativeLyricsTabLabel('Lyrics')).toBe(true);
  expect(isNativeLyricsTabLabel('Commentaires')).toBe(false);
  expect(isNativeLyricsTabLabel('À suivre')).toBe(false);
  expect(isNativeLyricsTabLabel('My Lyrics Playlist')).toBe(false);
});

test('reconnaît les deux routes natives de l’historique', () => {
  expect(preferredSidebarLabel('/history')).toBe('historique');
  expect(preferredSidebarLabel('/browse/FEmusic_history')).toBe('historique');
  expect(isHistoryPath('/history/')).toBe(true);
  expect(isHistoryPath('/library/history')).toBe(false);
});

test('insère une seule entrée juste après Bibliothèque et navigue dans le compte natif', () => {
  const window = new Window({ url: 'https://music.youtube.com/' });
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = '<ytmusic-app></ytmusic-app><div id="guide"><ytmusic-guide-entry-renderer selected><span id="title">Accueil</span></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer><a href="/library">Bibliothèque</a></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer><span>Playlist</span></ytmusic-guide-entry-renderer></div>';
  const app = doc.querySelector('ytmusic-app') as HTMLElement & { navigate: (page: string) => void };
  const visited: string[] = [];
  app.navigate = (page) => { visited.push(page); };
  polishSidebar(doc, '/');
  polishSidebar(doc, '/history');
  const links = doc.querySelectorAll<HTMLAnchorElement>('[data-ytmd-history-link]');
  expect(links.length).toBe(1);
  const link = links[0];
  expect(link.previousElementSibling?.textContent).toBe('Bibliothèque');
  expect(link.getAttribute('href')).toBe('/history');
  expect(link.getAttribute('aria-current')).toBe('page');
  expect(doc.querySelectorAll('[data-ytmd-active-nav]').length).toBe(0);
  link.click();
  expect(visited).toEqual([HISTORY_BROWSE_ID]);
  polishSidebar(doc, '/library');
  expect(link.hasAttribute('aria-current')).toBe(false);
  expect(doc.querySelector('[data-ytmd-active-nav]')?.textContent).toBe('Bibliothèque');
});

test('ne duplique pas une entrée native et répare un guide reconstruit', () => {
  const window = new Window({ url: 'https://music.youtube.com/' });
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = '<div id="guide"><ytmusic-guide-entry-renderer><a href="/library">Library</a></ytmusic-guide-entry-renderer></div>';
  polishSidebar(doc, '/history');
  const guide = doc.getElementById('guide')!;
  const native = doc.createElement('ytmusic-guide-entry-renderer');
  const anchor = doc.createElement('a');
  anchor.href = '/history';
  anchor.textContent = 'History';
  native.appendChild(anchor);
  guide.appendChild(native);
  polishSidebar(doc, '/history');
  expect(doc.querySelector('[data-ytmd-history-link]')).toBeNull();
  expect(native.hasAttribute('data-ytmd-active-nav')).toBe(true);
  native.remove();
  polishSidebar(doc, '/history');
  expect(doc.querySelectorAll('[data-ytmd-history-link]').length).toBe(1);
});

test('reprend la taille et les alignements du bouton natif Bibliothèque', () => {
  const window = new Window({ url: 'https://music.youtube.com/' });
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = '<div id="guide"><ytmusic-guide-entry-renderer><tp-yt-paper-item><yt-icon></yt-icon><span id="title" style="font-size:16px;font-weight:500">Bibliothèque</span></tp-yt-paper-item></ytmusic-guide-entry-renderer></div>';
  const rect = (left: number, width: number, height: number) => ({ left, right: left + width, width, height, x: left, y: 0, top: 0, bottom: height, toJSON: () => ({}) });
  doc.getElementById('guide')!.getBoundingClientRect = () => rect(0, 250, 200);
  doc.querySelector('tp-yt-paper-item')!.getBoundingClientRect = () => rect(8, 234, 48);
  doc.querySelector('yt-icon')!.getBoundingClientRect = () => rect(24, 24, 24);
  doc.getElementById('title')!.getBoundingClientRect = () => rect(68, 100, 20);
  polishSidebar(doc, '/');
  const link = doc.querySelector<HTMLAnchorElement>('[data-ytmd-history-link]')!;
  expect(link.style.getPropertyValue('--ytmd-history-height')).toBe('48px');
  expect(link.style.getPropertyValue('--ytmd-history-left')).toBe('8px');
  expect(link.style.getPropertyValue('--ytmd-history-right')).toBe('8px');
  expect(link.style.getPropertyValue('--ytmd-history-padding')).toBe('16px');
  expect(link.style.getPropertyValue('--ytmd-history-gap')).toBe('20px');
  expect(link.style.getPropertyValue('--ytmd-history-font-size')).toBe('16px');
});
