import { expect, test } from '@playwright/test';

import { getMenuItemByPath, snapshotMenu } from '../menu-snapshot';
import { dispatchMenuEvent } from '../menu-dispatch';

import type { Menu, MenuItem, BrowserWindow, App, WebContents } from 'electron';

function item(values: Partial<MenuItem>): MenuItem {
  return {
    id: '', label: '', type: 'normal', enabled: true, visible: true, checked: false,
    commandId: undefined, ...values,
  } as MenuItem;
}

test('all plugin toggles have usable paths even without Electron commandId', async () => {
  const changed: boolean[] = [];
  const toggle = item({
    id: 'ytmd-plugin:album-color-theme', label: 'Couleur de la pochette', type: 'checkbox',
    click: (target: MenuItem) => changed.push(target.checked),
  });
  const menu = { items: [item({
    type: 'submenu',
    submenu: { items: [toggle] } as Menu,
  })] } as Menu;
  const snapshot = snapshotMenu(menu);
  const entry = snapshot.items[0].submenu?.items[0];
  expect(entry?.ytmdPath).toBe('0/0');
  expect(entry?.id).toBe('ytmd-plugin:album-color-theme');
  expect(entry?.commandId).toBeUndefined();
  const target = getMenuItemByPath(menu, entry!.ytmdPath)!;
  expect(await dispatchMenuEvent(target, null, {} as WebContents,
    { quit: () => {} } as Pick<App, 'quit'>)).toBe(true);
  expect(changed).toEqual([true]);
  expect(getMenuItemByPath(menu, '0/1')).toBeNull();
  expect(getMenuItemByPath(menu, '__proto__')).toBeNull();
  expect(getMenuItemByPath(menu, '0/-1')).toBeNull();
  expect(getMenuItemByPath(menu, '0/01')).toBeNull();
});
