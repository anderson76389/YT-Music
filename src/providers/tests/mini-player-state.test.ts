import { expect, test } from '@playwright/test';

import { normalizeMiniVolume } from '../mini-player-state';

test('le mini-lecteur accepte uniquement un volume numérique entre 0 et 100', () => {
  expect(normalizeMiniVolume(0)).toBe(0);
  expect(normalizeMiniVolume(64.8)).toBe(65);
  expect(normalizeMiniVolume(100)).toBe(100);
  expect(normalizeMiniVolume(-20)).toBe(0);
  expect(normalizeMiniVolume(130)).toBe(100);
  expect(normalizeMiniVolume('50')).toBeNull();
  expect(normalizeMiniVolume(Number.NaN)).toBeNull();
  expect(normalizeMiniVolume(Infinity)).toBeNull();
});
