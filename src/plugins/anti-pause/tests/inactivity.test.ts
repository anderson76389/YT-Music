import { expect, test } from '@playwright/test';

import {
  dismissIdlePrompt,
  HEARTBEAT_INTERVAL_MS,
  startIdleHeartbeat,
} from '../runtime';

test('Anti-Pause : 30 minutes simulees avec heartbeat toutes les 15 secondes', () => {
  let now = 0;
  let running = false;
  let callback: (() => void) | undefined;
  let period = 0;
  const target: { _lact?: number } = {};
  const stop = startIdleHeartbeat(target, {
    now: () => now,
    setInterval: (fn, ms) => {
      callback = fn;
      period = ms;
      running = true;
      return 1;
    },
    clearInterval: () => {
      running = false;
    },
  });

  expect(target._lact).toBe(0);
  expect(period).toBe(HEARTBEAT_INTERVAL_MS);
  for (now = period; now <= 30 * 60_000; now += period) {
    if (running) callback?.();
    expect(target._lact).toBe(now);
  }

  expect(target._lact).toBe(1_800_000);
  stop();
  now += period;
  if (running) callback?.();
  expect(target._lact).toBe(1_800_000);
});

test('Anti-Pause : absence de popup, aucune action sur la lecture', () => {
  let clicked = 0;
  const documentMock = {
    querySelector() {
      clicked++;
      return null;
    },
  } as unknown as Document;
  expect(dismissIdlePrompt(documentMock)).toBe(false);
  expect(clicked).toBe(1);
});

test('Anti-Pause : la modale d’inactivité est acquittee et la lecture relancee', async () => {
  let clicks = 0;
  let plays = 0;
  const fakeVideo = {
    paused: true,
    play: async () => {
      plays++;
    },
  };
  const fakeDialog = {
    querySelector: () => ({
      click: () => {
        clicks++;
      },
    }),
  };
  const fakeDoc = {
    querySelector: (selector: string) =>
      selector === 'ytmusic-you-there-renderer' ? fakeDialog : fakeVideo,
  } as unknown as Document;

  expect(dismissIdlePrompt(fakeDoc)).toBe(true);
  await Promise.resolve();
  expect(clicks).toBe(1);
  expect(plays).toBe(1);
});
