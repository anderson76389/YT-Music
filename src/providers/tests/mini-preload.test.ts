import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

test('the standalone mini preload only requires electron and forwards allowed commands', () => {
  const sent: unknown[][] = [];
  let bridge: {
    command: (command: string, value?: number) => void;
    onState: (listener: (state: unknown) => void) => void;
  } | undefined;
  let stateListener: ((event: unknown, state: unknown) => void) | undefined;
  const code = readFileSync(resolve('assets/mini-player-preload.cjs'), 'utf8');
  runInNewContext(code, {
    require(name: string) {
      expect(name).toBe('electron');
      return {
        contextBridge: {
          exposeInMainWorld(name: string, value: typeof bridge) {
            expect(name).toBe('miniPlayer');
            bridge = value;
          },
        },
        ipcRenderer: {
          send(...args: unknown[]) { sent.push(args); },
          on(channel: string, listener: typeof stateListener) {
            expect(channel).toBe('ytmd:mini-state');
            stateListener = listener;
          },
        },
      };
    },
  });
  expect(bridge).toBeDefined();
  const api = bridge!;
  const states: unknown[] = [];
  api.onState((state) => states.push(state));
  stateListener?.({}, { volume: 65 });
  api.command('volume', 150);
  api.command('volume', NaN);
  api.command('play');
  api.command('previous');
  api.command('next');
  api.command('close');
  api.command('unknown');
  expect(states).toEqual([{ volume: 65 }]);
  expect(sent).toEqual([
    ['ytmd:mini-command', 'ready'],
    ['ytmd:mini-command', 'volume', 100],
    ['ytmd:mini-command', 'play'],
    ['ytmd:mini-command', 'previous'],
    ['ytmd:mini-command', 'next'],
    ['ytmd:mini-command', 'close'],
  ]);
});
