import { deepmerge } from 'deepmerge-ts';
import { rendererPlugins } from 'virtual:plugins';

import { t } from '@/i18n';
import { LoggerPrefix, startPlugin, stopPlugin } from '@/utils';

import { mountPluginStyles, unmountPluginStyles } from './plugin-styles';

import type { MusicPlayer } from '@/types/music-player';
import type { RendererContext } from '@/types/contexts';
import type { PluginConfig, PluginDef } from '@/types/plugins';

const loadedPluginMap: Record<
  string,
  PluginDef<unknown, unknown, unknown>
> = {};
const loadingPluginMap = new Map<string, Promise<void>>();
let readyPlayerApi: MusicPlayer | null = null;

/** Les plugins chargés lentement recevront aussi l'API du lecteur. */
export const setRendererPlayerApi = (api: MusicPlayer) => {
  readyPlayerApi = api;
};

export const createContext = <Config extends PluginConfig>(
  id: string,
): RendererContext<Config> => ({
  getConfig: () =>
    window.ipcRenderer.invoke('peard:get-config', id) as Promise<Config>,
  setConfig: async (newConfig) => {
    await window.ipcRenderer.invoke('peard:set-config', id, newConfig);
  },
  ipc: {
    send: (event: string, ...args: unknown[]) => {
      window.ipcRenderer.send(event, ...args);
    },
    invoke: (event: string, ...args: unknown[]) =>
      window.ipcRenderer.invoke(event, ...args),
    on: (event: string, listener: CallableFunction) => {
      window.ipcRenderer.on(event, (_, ...args: unknown[]) => {
        // oxlint-disable-next-line typescript/no-unsafe-call
        listener(...args);
      });
    },
    removeAllListeners: (event: string) => {
      window.ipcRenderer.removeAllListeners(event);
    },
  },
});

export const forceUnloadRendererPlugin = async (id: string) => {
  const plugin = loadedPluginMap[id] ?? (await rendererPlugins())[id];
  if (!plugin) return;

  const hasStopped = await stopPlugin(id, plugin, {
    ctx: 'renderer',
    context: createContext(id),
  });

  // Ancien code : les adoptedStyleSheets n'étaient JAMAIS supprimés.
  // Les thèmes restaient actifs, même quand leur plugin était décoché.
  unmountPluginStyles(document, id);
  try {
    await window.ipcRenderer.invoke('ytmd:plugin-css:disable', id);
  } catch (error) {
    console.warn('[YT Music] Impossible de retirer le CSS Electron de', id, error);
  }
  delete loadedPluginMap[id];

  if (hasStopped || !plugin.renderer || hasStopped === null) {
    console.log(
      LoggerPrefix,
      t('common.console.plugins.unloaded', { pluginName: id }),
    );
  } else {
    console.error(
      LoggerPrefix,
      t('common.console.plugins.unload-failed', { pluginName: id }),
    );
  }
};

export const forceLoadRendererPlugin = (id: string): Promise<void> => {
  if (loadedPluginMap[id]) return Promise.resolve();
  const pending = loadingPluginMap.get(id);
  if (pending) return pending;

  const task = (async () => {
    const plugin = (await rendererPlugins())[id];
    if (!plugin) return;
    const started = await startPlugin(id, plugin, {
      ctx: 'renderer',
      context: createContext(id),
    });
    if (started === false) {
      console.error(LoggerPrefix, 'Plugin renderer non démarré :', id);
      return;
    }

    // Si l'utilisateur a désactivé l'extension pendant un démarrage
    // asynchrone, ne pas laisser son CSS ou son timer réapparaître.
    const stillEnabled = await window.mainConfig.plugins.isEnabled(id);
    if (!stillEnabled) {
      await stopPlugin(id, plugin, {
        ctx: 'renderer',
        context: createContext(id),
      });
      return;
    }

    if (plugin.stylesheets?.length) {
      // Les deux méthodes sont complémentaires : Electron applique les CSS
      // indépendamment de la politique CSP du site; les balises DOM servent
      // au diagnostic. Un échec de l'une ne doit pas masquer l'autre.
      mountPluginStyles(document, id, plugin.stylesheets);
      try {
        const applied = await window.ipcRenderer.invoke(
          'ytmd:plugin-css:enable',
          id,
        );
        if (!applied) {
          console.warn('[YT Music] Injection CSS Electron refusée pour', id);
        }
      } catch (error) {
        console.error('[YT Music] Injection CSS Electron impossible', id, error);
      }
    }
    loadedPluginMap[id] = plugin;
    if (readyPlayerApi && typeof plugin.renderer !== 'function') {
      try {
        await plugin.renderer?.onPlayerApiReady?.call(
          plugin.renderer,
          readyPlayerApi,
          createContext(id),
        );
      } catch (error) {
        console.error('[YT Music] API du lecteur indisponible pour', id, error);
      }
    }
    console.log(
      LoggerPrefix,
      t('common.console.plugins.loaded', { pluginName: id }),
    );
  })().finally(() => loadingPluginMap.delete(id));

  loadingPluginMap.set(id, task);
  return task;
};

export const loadAllRendererPlugins = async () => {
  const pluginConfigs = window.mainConfig.plugins.getPlugins();
  const tasks: Promise<void>[] = [];

  // Un plugin lent ne doit plus empêcher les autres de démarrer.
  for (const [pluginId, pluginDef] of Object.entries(await rendererPlugins())) {
    const config = deepmerge(
      pluginDef.config ?? { enabled: false },
      pluginConfigs[pluginId] ?? {},
    );
    tasks.push(
      (config.enabled
        ? forceLoadRendererPlugin(pluginId)
        : loadedPluginMap[pluginId]
          ? forceUnloadRendererPlugin(pluginId)
          : Promise.resolve()
      ).catch((error: unknown) => {
        console.error('[YT Music] Erreur de chargement du plugin', pluginId, error);
      }),
    );
  }

  // Après 8 secondes, la lecture peut démarrer même si une extension attend
  // un élément de page qui n'apparaîtra jamais. Les plugins retardataires
  // reçoivent l'API du lecteur dès qu'ils terminent.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(() => {
      console.warn('[YT Music] Extensions encore en cours de chargement');
      resolve();
    }, 8000);
  });
  await Promise.race([Promise.allSettled(tasks).then(() => {}), deadline]);
  if (timeout) clearTimeout(timeout);
};

export const unloadAllRendererPlugins = async () => {
  for (const id of Object.keys(loadedPluginMap)) {
    await forceUnloadRendererPlugin(id);
  }
};

export const getLoadedRendererPlugin = (
  id: string,
): PluginDef<unknown, unknown, unknown> | undefined => {
  return loadedPluginMap[id];
};

export const getAllLoadedRendererPlugins = () => {
  return loadedPluginMap;
};
