import { expect, test } from '@playwright/test';

import { dispatchMenuEvent } from '../menu-dispatch';

import type { MenuItem, BrowserWindow, WebContents, App } from 'electron';

function fixture() {
  const calls: string[] = [];
  let zoom = 0;
  let fullScreen = false;

  const contents = {
    reload: () => calls.push('reload'),
    reloadIgnoringCache: () => calls.push('forcereload'),
    getZoomLevel: () => zoom,
    setZoomLevel: (value: number) => {
      zoom = value;
      calls.push(`zoom:${value}`);
    },
    toggleDevTools: () => calls.push('devtools'),
  } as unknown as WebContents;

  const window = {
    webContents: contents,
    isFullScreen: () => fullScreen,
    setFullScreen: (value: boolean) => {
      fullScreen = value;
      calls.push('fullscreen');
    },
  } as unknown as BrowserWindow;

  const application = {
    quit: () => calls.push('quit'),
  } as unknown as Pick<App, 'quit'>;

  return { contents, window, application, calls };
}

function item(value: object): MenuItem {
  return {
    type: 'normal',
    checked: false,
    enabled: true,
    visible: true,
    ...value,
  } as MenuItem;
}

test('menu intégré : activation et désactivation transmettent item.checked', () => {
  const f = fixture();
  const states: boolean[] = [];
  const checkbox = item({
    type: 'checkbox',
    click: (it: MenuItem) => states.push(it.checked),
  });

  expect(dispatchMenuEvent(checkbox, f.window, f.contents, f.application)).toBe(true);
  expect(dispatchMenuEvent(checkbox, f.window, f.contents, f.application)).toBe(true);
  expect(states).toEqual([true, false]);
});

test('menu intégré : radio sélectionnée reçoit la valeur cochée', () => {
  const f = fixture();
  const states: boolean[] = [];
  const radio = item({
    type: 'radio',
    click: (it: MenuItem) => states.push(it.checked),
  });

  expect(dispatchMenuEvent(radio, f.window, f.contents, f.application)).toBe(true);
  expect(states).toEqual([true]);
});

test('menu intégré : les entrées désactivées et sous-menus ne sont pas exécutés', () => {
  const f = fixture();
  expect(dispatchMenuEvent(item({ enabled: false, click: () => f.calls.push('bad') }), f.window, f.contents, f.application)).toBe(false);
  expect(dispatchMenuEvent(item({ type: 'submenu', click: () => f.calls.push('bad') }), f.window, f.contents, f.application)).toBe(false);
  expect(dispatchMenuEvent(null, f.window, f.contents, f.application)).toBe(false);
  expect(f.calls).toEqual([]);
});

test('menu intégré : zoom, rechargement, plein écran, devtools et quitter fonctionnent', () => {
  const f = fixture();
  for (const role of ['zoomIn', 'zoomOut', 'resetZoom', 'reload', 'forceReload', 'toggleFullScreen', 'toggleDevTools', 'quit']) {
    expect(dispatchMenuEvent(item({ role }), f.window, f.contents, f.application)).toBe(true);
  }
  expect(f.calls).toEqual([
    'zoom:0.5',
    'zoom:0',
    'zoom:0',
    'reload',
    'forcereload',
    'fullscreen',
    'devtools',
    'quit',
  ]);
});
