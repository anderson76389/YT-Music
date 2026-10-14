import { expect, test } from '@playwright/test';

import { buildAppearanceStyles } from '../settings-appearance';

const defaults = { removeUpgradeButton: false, likeButtons: '', swapLikeButtonsOrder: false };

test('aucun effet visuel résiduel lorsque les préférences sont désactivées', () => {
  expect(buildAppearanceStyles(defaults)).toBe('');
});

test('les trois ajustements de Pear Desktop sont indépendants', () => {
  expect(buildAppearanceStyles({ ...defaults, removeUpgradeButton: true })).toContain('guide-section');
  expect(buildAppearanceStyles({ ...defaults, likeButtons: 'hide' })).toContain('none');
  expect(buildAppearanceStyles({ ...defaults, likeButtons: 'force' })).toContain('inherit');
  expect(buildAppearanceStyles({ ...defaults, swapLikeButtonsOrder: true })).toContain('row-reverse');
  expect(buildAppearanceStyles(defaults)).not.toContain('row-reverse');
});
