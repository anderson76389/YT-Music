import { expect, test } from '@playwright/test';

import {
  processAdPlayback,
  restoreAdPlayback,
  type AdPlaybackSnapshot,
  type AdVideo,
} from '../ad-skip';

test('la publicité est coupée, accélérée et sautée puis le volume est restauré', () => {
  const video: AdVideo = {
    muted: false,
    playbackRate: 1.25,
    currentTime: 0,
    duration: 30,
  };

  let state = processAdPlayback(video, true);
  expect(video.muted).toBe(true);
  expect(video.playbackRate).toBe(16);
  expect(video.currentTime).toBeCloseTo(29.85);

  state = processAdPlayback(video, true, state);
  expect(state?.muted).toBe(false);
  expect(state?.playbackRate).toBe(1.25);

  state = processAdPlayback(video, false, state);
  expect(state).toBeUndefined();
  expect(video.muted).toBe(false);
  expect(video.playbackRate).toBe(1.25);
});

test('respecte le volume volontairement coupé avant la publicité', () => {
  const video: AdVideo = {
    muted: true,
    playbackRate: 0.75,
    currentTime: 12,
    duration: Infinity,
  };
  const state = processAdPlayback(video, true);
  expect(video.currentTime).toBe(12);
  restoreAdPlayback(state);
  expect(video.muted).toBe(true);
  expect(video.playbackRate).toBe(0.75);
});

test('ne modifie jamais une lecture normale sans publicité', () => {
  const video: AdVideo = {
    muted: false,
    playbackRate: 1,
    currentTime: 20,
    duration: 100,
  };
  const state = processAdPlayback(video, false);
  expect(state).toBeUndefined();
  expect(video).toEqual({
    muted: false,
    playbackRate: 1,
    currentTime: 20,
    duration: 100,
  });
});

test('restaure le lecteur précédent si la vidéo est remplacée en pleine publicité', () => {
  const a: AdVideo = {
    muted: false,
    playbackRate: 1,
    currentTime: 0,
    duration: 10,
  };
  const b: AdVideo = {
    muted: true,
    playbackRate: 1.5,
    currentTime: 0,
    duration: 15,
  };
  let state: AdPlaybackSnapshot | undefined = processAdPlayback(a, true);
  state = processAdPlayback(b, true, state);
  expect(a.muted).toBe(false);
  expect(a.playbackRate).toBe(1);
  expect(b.muted).toBe(true);
  expect(b.playbackRate).toBe(16);
  restoreAdPlayback(state);
  expect(b.muted).toBe(true);
  expect(b.playbackRate).toBe(1.5);
});
