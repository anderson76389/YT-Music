import { expect, test } from '@playwright/test';

import { buildTrackerListSources, EASYLIST, EASYPRIVACY } from '../policy';

test('un filtre de réseau charge une liste publicitaire et une liste anti-traqueurs', () => {
  const result = buildTrackerListSources([], false);
  expect(result.urls).toEqual([EASYLIST, EASYPRIVACY]);
  expect(result.extra).toEqual([]);
  expect(result.disableDefaults).toBe(false);
});

test('les listes supplémentaires HTTPS sont prises en charge sans sources non sécurisées', () => {
  const extra = 'https://example.org/filter.txt';
  const result = buildTrackerListSources(
    [extra, 'http://example.org/not-secure', 'javascript:invalid'], true,
  );
  expect(result.urls).toEqual([extra]);
  expect(result.disableDefaults).toBe(true);
});

test('il est impossible de prétendre bloquer des traqueurs sans liste réseau', () => {
  expect(() => buildTrackerListSources([], true)).toThrow(
    'aucune liste de blocage',
  );
});
