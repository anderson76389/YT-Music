import { expect, test } from '@playwright/test';

import {
  hasSidebarChange,
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


function fakeElement(
  matchesRoot = false,
  insideRoot = false,
  containsRoot = false,
): Node {
  return {
    nodeType: 1,
    matches: () => matchesRoot,
    closest: () => (insideRoot ? {} : null),
    querySelector: () => (containsRoot ? {} : null),
  } as unknown as Node;
}

function fakeMutation(target: Node, addedNodes: Node[] = [], removedNodes: Node[] = []): MutationRecord {
  return { target, addedNodes, removedNodes } as unknown as MutationRecord;
}

test('navigation : ignore les mutations ordinaires de la liste de lecture', () => {
  expect(hasSidebarChange([fakeMutation(fakeElement(), [fakeElement()])])).toBe(false);
});

test('navigation : réagit aux entrées du guide et à sa reconstruction', () => {
  expect(hasSidebarChange([fakeMutation(fakeElement(false, true))])).toBe(true);
  expect(hasSidebarChange([fakeMutation(fakeElement(), [fakeElement(true)])])).toBe(true);
  expect(hasSidebarChange([fakeMutation(fakeElement(), [fakeElement(false, false, true)])])).toBe(true);
  expect(hasSidebarChange([fakeMutation(fakeElement(), [], [fakeElement(true)])])).toBe(true);
});
