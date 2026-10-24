import { expect, test } from '@playwright/test';

import {
  isNativeLyricsTabLabel,
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
