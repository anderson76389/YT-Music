import {
  contextBridge,
  ipcRenderer,
  type IpcRendererEvent,
  webFrame,
} from 'electron';
import is from 'electron-is';

import { loadI18n, setLanguage } from '@/i18n';

import * as config from './config';
import {
  forceLoadPreloadPlugin,
  forceUnloadPreloadPlugin,
  loadAllPreloadPlugins,
} from './loader/preload';

// @ts-expect-error dummy
globalThis.customElements = { define() {} };

new MutationObserver((mutations, observer) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      const elem = node as HTMLElement;
      if (elem.tagName !== 'SCRIPT') continue;

      const script = elem as HTMLScriptElement;
      if (
        !script.getAttribute('src')?.endsWith('custom-elements-es5-adapter.js')
      )
        continue;

      script.remove();

      observer.disconnect();
      return;
    }
  }
}).observe(document, { subtree: true, childList: true });

loadI18n().then(async () => {
  await setLanguage(config.get('options.language') ?? 'en');
  await loadAllPreloadPlugins();
});

ipcRenderer.on('plugin:unload', async (_, id: string) => {
  await forceUnloadPreloadPlugin(id);
});
ipcRenderer.on('plugin:enable', async (_, id: string) => {
  await forceLoadPreloadPlugin(id);
});

// Electron's preload may have a different appData path from the main process
// when running an NSIS portable build. Reading/writing a second Conf instance
// made menu toggles look saved while plugins still saw enabled=false.
// All renderer-facing configuration accesses now use the main process.
contextBridge.exposeInMainWorld('mainConfig', {
  ...config,
  get: (key: string) => ipcRenderer.sendSync('ytmd:config:get', key),
  set: (key: string, value: unknown) =>
    ipcRenderer.sendSync('ytmd:config:set', key, value),
  setPartial: (key: string, value: object, defaults?: object) =>
    ipcRenderer.sendSync('ytmd:config:set-partial', key, value, defaults),
  setMenuOption: (key: string, value: unknown) =>
    ipcRenderer.sendSync('ytmd:config:set-menu-option', key, value),
  plugins: {
    ...config.plugins,
    getPlugins: () => ipcRenderer.sendSync('ytmd:plugins:get'),
    getOptions: (name: string) =>
      ipcRenderer.sendSync('ytmd:plugins:get-options', name),
    setOptions: (name: string, options: object, exclude?: string[]) =>
      ipcRenderer.sendSync('ytmd:plugins:set-options', name, options, exclude),
    setMenuOptions: (name: string, options: object, exclude?: string[]) =>
      ipcRenderer.sendSync('ytmd:plugins:set-menu-options', name, options, exclude),
    enable: (name: string) => ipcRenderer.sendSync('ytmd:plugins:enable', name),
    disable: (name: string) => ipcRenderer.sendSync('ytmd:plugins:disable', name),
    isEnabled: (name: string) => ipcRenderer.invoke('ytmd:plugins:is-enabled', name),
  },
});
contextBridge.exposeInMainWorld('electronIs', is);
contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => ipcRenderer.on(channel, listener),
  off: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.off(channel, listener),
  once: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => ipcRenderer.once(channel, listener),
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),
  removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
  sendSync: (channel: string, ...args: unknown[]): unknown =>
    ipcRenderer.sendSync(channel, ...args),
  sendToHost: (channel: string, ...args: unknown[]) =>
    ipcRenderer.sendToHost(channel, ...args),
});
contextBridge.exposeInMainWorld('reload', () =>
  ipcRenderer.send('peard:reload'),
);
contextBridge.exposeInMainWorld(
  'ELECTRON_RENDERER_URL',
  process.env.ELECTRON_RENDERER_URL,
);

const [path, script] = ipcRenderer.sendSync('get-renderer-script') as [
  string | null,
  string,
];
// Ne jamais bloquer le thread du preload avec une attente synchrone :
 // la réponse de l'injection JavaScript arrive elle-même de manière asynchrone.
 // Une boucle while empêchait son callback de s'exécuter et pouvait figer
 // le démarrage (notamment après extraction du portable).
if (path) {
  void webFrame.executeJavaScriptInIsolatedWorld(
    0,
    [{ code: script, url: path }],
    true,
  ).catch((error: unknown) => {
    console.error('[YT Music] Injection du renderer impossible', error);
  });
} else {
  void webFrame.executeJavaScript(script, true).catch((error: unknown) => {
    console.error('[YT Music] Injection du renderer impossible', error);
  });
}
