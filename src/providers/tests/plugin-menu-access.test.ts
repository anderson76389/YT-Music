import { expect, test } from '@playwright/test';

import { createPluginMenuAccess, selectPluginMenuItems } from '../plugin-menu-access';

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

test('Ajustements visuels retrouve les plugins ambiant et transparent', () => {
  const ids = ['album-color-theme', 'ambient-mode', 'in-app-menu', 'transparent-player'];
  const menus: MenuItemConstructorOptions[] = [
    { label: 'Couleurs de la pochette', type: 'checkbox' },
    { label: 'Mode ambiant', submenu: [{ label: 'Qualité' }] },
    { label: 'Menu intégré', type: 'checkbox' },
    { label: 'Mode transparent', submenu: [{ label: 'Opacité' }] },
  ];

  const visual = selectPluginMenuItems(ids, menus, [
    'ambient-mode', 'transparent-player', 'unknown-plugin',
  ]);
  expect(visual).toHaveLength(2);
  expect(visual[0]).toBe(menus[1]);
  expect(visual[1]).toBe(menus[3]);
  expect(visual[0].submenu).toHaveLength(1);
  expect(visual[1].submenu).toHaveLength(1);
});
