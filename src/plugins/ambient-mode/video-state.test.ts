import { expect, test } from '@playwright/test';

import { canDrawAmbientVideo } from './video-state';

function fakeVideo(
  paused: boolean,
  videoWidth: number,
  videoHeight: number,
): HTMLVideoElement {
  return { paused, videoWidth, videoHeight } as HTMLVideoElement;
}

test('mode ambiant : aucune animation GPU en musique seule ou vidéo masquée', () => {
  expect(canDrawAmbientVideo(null, true)).toBe(false);
  expect(canDrawAmbientVideo(fakeVideo(true, 1280, 720), true)).toBe(false);
  expect(canDrawAmbientVideo(fakeVideo(false, 1280, 720), false)).toBe(false);
  expect(canDrawAmbientVideo(fakeVideo(false, 0, 0), true)).toBe(false);
});

test('mode ambiant : conserve les images en lecture vidéo visible', () => {
  expect(canDrawAmbientVideo(fakeVideo(false, 1280, 720), true)).toBe(true);
});
