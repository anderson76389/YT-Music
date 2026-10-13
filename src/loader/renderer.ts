import { deepmerge } from 'deepmerge-ts';
import { rendererPlugins } from 'virtual:plugins';

import { t } from '@/i18n';
import { LoggerPrefix, startPlugin, stopPlugin } from '@/utils';

import { mountPluginStyles, unmountPluginStyles } from './plugin-styles';

import type { RendererContext } from '@/types/contexts';
import type { PluginConfig, PluginDef } from '@/types/plugins';

const loadedPluginMap: Record<
  string,
  PluginDef<unknown, unknown, unknown>
> = {};

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
  delete loadedPluginMap[id];

  if (hasStopped || (hasStopped === null && plugin?.renderer)) {
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

export const forceLoadRendererPlugin = async (id: string) => {
  if (loadedPluginMap[id]) return;

  const plugin = (await rendererPlugins())[id];
  if (!plugin) return;

  const started = await startPlugin(id, plugin, {
    ctx: 'renderer',
    context: createContext(id),
  });

  // Ne jamais marquer un plugin comme chargé si sa fonction start()
  // a échoué, même si des stylesheets sont déclarées.
  if (started === false) {
    console.error(
      LoggerPrefix,
      t('common.console.plugins.initialize-failed', { pluginName: id }),
    );
    return;
  }

  loadedPluginMap[id] = plugin;
  if (plugin.stylesheets?.length) {
    mountPluginStyles(document, id, plugin.stylesheets);
  }

  console.log(
    LoggerPrefix,
    t('common.console.plugins.loaded', { pluginName: id }),
  );
};

export const loadAllRendererPlugins = async () => {
  const pluginConfigs = window.mainConfig.plugins.getPlugins();

  for (const [pluginId, pluginDef] of Object.entries(await rendererPlugins())) {
    const config = deepmerge(pluginDef.config, pluginConfigs[pluginId] ?? {});

    if (config.enabled) {
      await forceLoadRendererPlugin(pluginId);
    } else {
      if (loadedPluginMap[pluginId]) {
        await forceUnloadRendererPlugin(pluginId);
      }
    }
  }
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
