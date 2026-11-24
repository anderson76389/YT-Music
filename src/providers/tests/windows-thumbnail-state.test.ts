import { expect, test } from '@playwright/test';

import { canRefreshThumbnail, getAdjustedThumbnailVolume, getThumbnailPlayingState } from '../windows-thumbnail-state';

test('la miniature continue à changer pendant que la fenêtre est réduite', () => {
  expect(canRefreshThumbnail(true, false)).toBe(true);
  expect(canRefreshThumbnail(true, true)).toBe(true);
  expect(canRefreshThumbnail(false, false)).toBe(false);
  expect(canRefreshThumbnail(false, true)).toBe(true);
});

test('l’état réel du lecteur prime sur un élément vidéo inactif', () => {
  expect(getThumbnailPlayingState(1, true, false)).toBe(true);
  expect(getThumbnailPlayingState(2, false, false)).toBe(false);
  expect(getThumbnailPlayingState(0, false, true)).toBe(false);
  expect(getThumbnailPlayingState(undefined, false, false)).toBe(true);
  expect(getThumbnailPlayingState(undefined, true, false)).toBe(false);
});

test('le volume de la miniature évolue par pas de cinq et reste borné', () => {
  expect(getAdjustedThumbnailVolume(50, 1)).toBe(55);
  expect(getAdjustedThumbnailVolume(50, -1)).toBe(45);
  expect(getAdjustedThumbnailVolume(98, 1)).toBe(100);
  expect(getAdjustedThumbnailVolume(2, -1)).toBe(0);
  expect(getAdjustedThumbnailVolume(Number.NaN, 1)).toBeNull();
  expect(getAdjustedThumbnailVolume(50, 10)).toBeNull();
});
