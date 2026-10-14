import { expect, test } from '@playwright/test';

import { getAudioSession, rememberAudioSession } from '../audio-session';

test('les extensions audio retrouvent la session en cours après activation', () => {
  const current = { audioContext: {} as AudioContext, audioSource: {} as MediaElementAudioSourceNode };
  rememberAudioSession(current);
  expect(getAudioSession()).toBe(current);
});
