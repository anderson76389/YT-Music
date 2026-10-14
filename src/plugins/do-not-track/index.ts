import { contextBridge, webFrame, type BrowserWindow } from 'electron';

import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import {
  isBlockerEnabled,
  loadTrackerBlockerEngine,
  unloadTrackerBlockerEngine,
} from './blocker';
import { inject, isInjected } from './injectors/inject';
import injectCliqzPreload from './injectors/inject-cliqz-preload';
import { blockers } from './types';

export interface TrackerBlockerConfig {
  /**
   * Whether to enable the tracker blocker.
   * @default true
   */
  enabled: boolean;
  /**
   * When enabled, the tracker blocker will cache the blocklists.
   * @default true
   */
  cache: boolean;
  /**
   * Which tracker blocker to use.
   * @default blockers.WithBlocklists
   */
  blocker: (typeof blockers)[keyof typeof blockers];
  /**
   * Additional list of filters to use.
   * @example ["https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt"]
   * @default []
   */
  additionalBlockLists: string[];
  /**
   * Disable the default blocklists.
   * @default false
   */
  disableDefaultLists: boolean;
}

export default createPlugin({
  name: () => t('plugins.do-not-track.name'),
  description: () => t('plugins.do-not-track.description'),
  // Les hooks JSON.parse du preload ne peuvent pas être retirés à chaud.
  restartNeeded: true,
  config: {
    enabled: false,
    cache: true,
    // Unlike the ad-JSON pruner, this mode actually blocks network requests.
    blocker: blockers.WithBlocklists,
    additionalBlockLists: [],
    disableDefaultLists: false,
  } as TrackerBlockerConfig,
  menu: async ({ getConfig, setConfig }) => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.do-not-track.menu.blocker'),
        submenu: Object.values(blockers).map((blocker) => ({
          label: blocker === blockers.WithBlocklists
            ? 'Bloquer les traqueurs et publicités (listes Ghostery)'
            : 'Filtrage du lecteur uniquement (ne bloque pas les traqueurs)',
          type: 'radio',
          checked: (config.blocker || blockers.WithBlocklists) === blocker,
          click() {
            setConfig({ blocker });
          },
        })),
      },
    ];
  },
  backend: {
    mainWindow: null as BrowserWindow | null,
    async start({ getConfig, window }) {
      const config = await getConfig();
      this.mainWindow = window;

      if (config.blocker === blockers.WithBlocklists) {
        await loadTrackerBlockerEngine(
          window.webContents.session,
          config.cache,
          config.additionalBlockLists,
          config.disableDefaultLists,
        );
      }
    },
    stop({ window }) {
      if (isBlockerEnabled(window.webContents.session)) {
        unloadTrackerBlockerEngine(window.webContents.session);
      }
    },
    async onConfigChange(newConfig) {
      if (!this.mainWindow) return;
      const session = this.mainWindow.webContents.session;
      if (!newConfig.enabled || newConfig.blocker !== blockers.WithBlocklists) {
        if (isBlockerEnabled(session)) unloadTrackerBlockerEngine(session);
        return;
      }
      if (!isBlockerEnabled(session)) {
        await loadTrackerBlockerEngine(
          session,
          newConfig.cache,
          newConfig.additionalBlockLists,
          newConfig.disableDefaultLists,
        );
      }
    },
  },
  preload: {
    // see #1478
    script: `const _prunerFn = window._pruner;
    window._pruner = undefined;
    JSON.parse = new Proxy(JSON.parse, {
      apply() {
        return _prunerFn(Reflect.apply(...arguments));
      },
    });
    Response.prototype.json = new Proxy(Response.prototype.json, {
      apply() {
        return Reflect.apply(...arguments).then((o) => _prunerFn(o));
      },
    }); 0`,
    async start({ getConfig }) {
      const config = await getConfig();

      if (config.blocker === blockers.InPlayer && !isInjected()) {
        inject(contextBridge);
        await webFrame.executeJavaScript(this.script);
      } else if (config.blocker === blockers.WithBlocklists) {
        await injectCliqzPreload();
      }
    },
    async onConfigChange(newConfig) {
      if (newConfig.blocker === blockers.InPlayer && !isInjected()) {
        inject(contextBridge);
        await webFrame.executeJavaScript(this.script);
      }
    },
  },
});
