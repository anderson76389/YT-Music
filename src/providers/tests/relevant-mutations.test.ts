import { expect, test } from '@playwright/test';
import { Window } from 'happy-dom';

import { hasRelevantMutation } from '../relevant-mutations';

test('ignores unrelated carousel mutations but detects replaced and changed navigation/player controls', () => {
  const window = new Window();
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = '<div id="guide"><span>Library</span></div><main><div id="carousel"></div></main>';
  const make = (target: Node, added: Node[] = [], removed: Node[] = []) =>
    ({ target, addedNodes: added, removedNodes: removed }) as unknown as MutationRecord;
  const carousel = doc.getElementById('carousel')!;
  const card = doc.createElement('div');
  card.appendChild(doc.createElement('img'));
  const guide = doc.getElementById('guide')!;
  const selector = '#guide, #movie_player, video, ytmusic-you-there-renderer';
  expect(hasRelevantMutation([make(carousel, [card])], selector)).toBe(false);
  expect(hasRelevantMutation([make(guide.firstElementChild!)], selector)).toBe(true);
  expect(hasRelevantMutation([make(doc.body, [], [guide])], selector)).toBe(true);
  const wrapper = doc.createElement('div');
  wrapper.appendChild(doc.createElement('video'));
  expect(hasRelevantMutation([make(doc.body, [wrapper])], selector)).toBe(true);
  expect(hasRelevantMutation([make(doc.body, [doc.createTextNode('text')])], selector)).toBe(false);
});
