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

test('menu intégré : activation et désactivation transmettent item.checked', async () => {
  const f = fixture();
  const states: boolean[] = [];
  const checkbox = item({
    type: 'checkbox',
    click: (it: MenuItem) => states.push(it.checked),
  });

  expect(await dispatchMenuEvent(checkbox, f.window, f.contents, f.application)).toBe(true);
  expect(await dispatchMenuEvent(checkbox, f.window, f.contents, f.application)).toBe(true);
  expect(states).toEqual([true, false]);
});

test('menu intégré : radio sélectionnée reçoit la valeur cochée', async () => {
  const f = fixture();
  const states: boolean[] = [];
  const radio = item({
    type: 'radio',
    click: (it: MenuItem) => states.push(it.checked),
  });

  expect(await dispatchMenuEvent(radio, f.window, f.contents, f.application)).toBe(true);
  expect(states).toEqual([true]);
});

test('menu intégré : les entrées désactivées et sous-menus ne sont pas exécutés', async () => {
  const f = fixture();
  expect(await dispatchMenuEvent(item({ enabled: false, click: () => f.calls.push('bad') }), f.window, f.contents, f.application)).toBe(false);
  expect(await dispatchMenuEvent(item({ type: 'submenu', click: () => f.calls.push('bad') }), f.window, f.contents, f.application)).toBe(false);
  expect(await dispatchMenuEvent(null, f.window, f.contents, f.application)).toBe(false);
  expect(f.calls).toEqual([]);
});

test('menu intégré : zoom, rechargement, plein écran, devtools et quitter fonctionnent', () => {
  const f = fixture();
  for (const role of ['zoomIn', 'zoomOut', 'resetZoom', 'reload', 'forceReload', 'toggleFullScreen', 'toggleDevTools', 'quit']) {
    expect(await dispatchMenuEvent(item({ role }), f.window, f.contents, f.application)).toBe(true);
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


test('le menu attend les commandes asynchrones avant son actualisation', async () => {
  const f = fixture();
  const events: string[] = [];
  const option = item({ click: async () => { events.push('begin'); await Promise.resolve(); events.push('saved'); } });
  expect(await dispatchMenuEvent(option, f.window, f.contents, f.application)).toBe(true);
  expect(events).toEqual(['begin', 'saved']);
});
