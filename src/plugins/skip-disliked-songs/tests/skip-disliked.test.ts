import { expect, test } from '@playwright/test';
import { Window } from 'happy-dom';

import { isDislikedButton } from '../logic';

test('ignore un bouton J’aime et les titres non évalués', async () => {
  const win = new Window();
  const like = win.document.createElement('div');
  like.setAttribute('id', 'button-shape-like');
  like.setAttribute('aria-pressed', 'true');
  expect(isDislikedButton(like as unknown as Element)).toBe(false);
  expect(isDislikedButton(null)).toBe(false);
  await win.close();
});

test('reconnaît les deux variantes du bouton Je n’aime pas', async () => {
  const win = new Window();
  const one = win.document.createElement('div');
  one.setAttribute('like-status', 'DISLIKE');
  expect(isDislikedButton(one as unknown as Element)).toBe(true);
  const two = win.document.createElement('div');
  two.setAttribute('id', 'button-shape-dislike');
  two.setAttribute('aria-pressed', 'true');
  expect(isDislikedButton(two as unknown as Element)).toBe(true);
  two.setAttribute('aria-pressed', 'false');
  expect(isDislikedButton(two as unknown as Element)).toBe(false);
  await win.close();
});
