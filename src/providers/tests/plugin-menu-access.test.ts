import { expect, test } from '@playwright/test';

import { createPluginMenuAccess } from '../plugin-menu-access';

import type { MenuItemConstructorOptions } from 'electron';

test('les 42 plugins sont accessibles dans la barre et dans Paramètres', () => {
  const plugins: MenuItemConstructorOptions[] = Array.from(
    { length: 42 },
    (_, index) => ({
      label: `Plugin ${index + 1}`,
      type: 'checkbox' as const,
      checked: index % 2 === 0,
      click: () => {},
    }),
  );

  const access = createPluginMenuAccess(plugins, 'Plugins');
  expect(access.toolbar.label).toBe('Plugins');
  expect(access.settings.label).toBe('Plugins');
  expect(access.toolbar.submenu).toHaveLength(42);
  expect(access.settings.submenu).toHaveLength(42);

  // Une configuration unique construit les deux menus, sans perdre les
  // callbacks et les états des cases à cocher.
  expect(access.toolbar.submenu).toBe(plugins);
  expect(access.settings.submenu).toBe(plugins);
  expect(plugins[0].checked).toBe(true);
  expect(plugins[1].checked).toBe(false);
  expect(typeof plugins[0].click).toBe('function');
});

test('le rafraîchissement des réglages reconstruit les deux points d’accès', () => {
  const enabled: MenuItemConstructorOptions[] = [
    { label: 'Mode ambiant', type: 'checkbox', checked: true },
    {
      label: 'Mode transparent',
      submenu: [
        { label: 'Activé', type: 'checkbox', checked: true },
        { label: 'Opacité 50 %', type: 'radio', checked: true },
      ],
    },
  ];
  const first = createPluginMenuAccess(enabled, 'Plugins');
  const updated: MenuItemConstructorOptions[] = [
    { label: 'Mode ambiant', type: 'checkbox', checked: false },
    { label: 'Mode transparent', type: 'checkbox', checked: false },
  ];
  const refreshed = createPluginMenuAccess(updated, 'Plugins');

  expect(first.toolbar.submenu).toBe(enabled);
  expect(first.settings.submenu).toBe(enabled);
  expect(refreshed.toolbar.submenu).toBe(updated);
  expect(refreshed.settings.submenu).toBe(updated);
  expect((updated[0] as MenuItemConstructorOptions).checked).toBe(false);
});
