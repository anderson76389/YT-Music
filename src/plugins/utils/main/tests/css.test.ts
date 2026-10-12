import { EventEmitter } from 'node:events';

import { expect, test } from '@playwright/test';

import { injectCSS } from '../css';

function fakeWebContents() {
  const events = new EventEmitter();
  const inserted: string[] = [];
  const removed: string[] = [];
  let counter = 0;
  const webContents = Object.assign(events, {
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
    getURL: () => 'https://music.youtube.com/',
    insertCSS: async (style: string) => {
      inserted.push(style);
      return `style-${++counter}`;
    },
    removeInsertedCSS: async (key: string) => {
      removed.push(key);
    },
  }) as unknown as Electron.WebContents;
  return { webContents, events, inserted, removed };
}

test('le thème CSS reste actif après navigation ou rechargement', async () => {
  const mock = fakeWebContents();
  const stop = await injectCSS(mock.webContents, 'body { color: red }');
  await Promise.resolve();
  expect(mock.inserted).toHaveLength(1);

  mock.events.emit('did-finish-load');
  await Promise.resolve();
  await Promise.resolve();
  expect(mock.inserted).toHaveLength(2);
  expect(mock.removed).toContain('style-1');

  await stop();
  expect(mock.removed).toContain('style-2');
  mock.events.emit('did-finish-load');
  await Promise.resolve();
  expect(mock.inserted).toHaveLength(2);
});

test('un thème désactivé ne revient pas au chargement suivant', async () => {
  const mock = fakeWebContents();
  const stopFirst = await injectCSS(mock.webContents, '.first{}');
  const stopSecond = await injectCSS(mock.webContents, '.second{}');
  await Promise.resolve();
  await stopFirst();
  mock.events.emit('did-finish-load');
  await Promise.resolve();
  await Promise.resolve();

  expect(mock.inserted.filter((s) => s === '.first{}')).toHaveLength(1);
  expect(mock.inserted.filter((s) => s === '.second{}')).toHaveLength(2);
  await stopSecond();
});
