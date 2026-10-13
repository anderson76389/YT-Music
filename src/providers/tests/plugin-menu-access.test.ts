import { expect, test } from '@playwright/test';

import { createPluginMenuEntries } from '../plugin-menu-access';

import type { MenuItemConstructorOptions } from 'electron';

test('cliquer sur Mode ambiant ou transparent affiche une véritable case à cocher', () => {
  for (const name of ['Mode ambiant', 'Mode transparent']) {
    const toggle: MenuItemConstructorOptions = {
      label: name,
      type: 'checkbox',
      checked: false,
      click: () => {},
    };

    const disabled = createPluginMenuEntries(
      toggle,
      [{ label: 'Opacité', submenu: [{ label: '50 %', type: 'radio' }] }],
      false,
      name,
    );
    expect(disabled).toHaveLength(1);
    expect(disabled[0]).toBe(toggle);
    expect(disabled[0].type).toBe('checkbox');
    expect(typeof disabled[0].click).toBe('function');

    const options: MenuItemConstructorOptions[] = [
      { label: 'Opacité', submenu: [{ label: '50 %', type: 'radio' }] },
    ];
    const enabled = createPluginMenuEntries(toggle, options, true, name);
    expect(enabled).toHaveLength(2);
    expect(enabled[0]).toBe(toggle);
    expect(enabled[1].label).toBe(`${name} — Réglages`);
    expect(enabled[1].submenu).toBe(options);
  }
});

test('un plugin sans réglages ne crée jamais de doublon', () => {
  const toggle: MenuItemConstructorOptions = {
    label: 'Anti-Pause & Purge Totale',
    type: 'checkbox',
    checked: true,
  };
  expect(
    createPluginMenuEntries(toggle, undefined, true, 'Anti-Pause'),
  ).toEqual([toggle]);
});
