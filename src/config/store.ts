import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { blockers } from '@/plugins/do-not-track/types';
import { DefaultPresetList, type Preset } from '@/plugins/downloader/types';

import { defaultConfig as defaults } from './defaults';

import type { TrackerBlockerConfig } from '@/plugins/do-not-track';
import type { SyncedLyricsPluginConfig } from '@/plugins/synced-lyrics/types';

// HACK: electron-store is ESM, but rolldown has a bug that prevents it from being imported properly in CommonJS context, so we have to use require here
/* oxlint-disable typescript/no-require-imports */
const Store = (
  require('electron-store') as {
    default: typeof import('electron-store').default;
  }
).default;
/* oxlint-enable typescript/no-require-imports */

export type IStore = InstanceType<
  typeof import('conf').default<Record<string, unknown>>
>;

const migrations = {
  // Une seule suppression des préférences des huit plugins retirés.
  // Les autres réglages, cookies et préférences restent intacts.
  '>=3.12.1'(store: IStore) {
    const removed = [
      'auth-proxy-adapter',
      'discord',
      'clock',
      'lumiastream',
      'music-together',
      'shortcuts',
      'scrobbler',
      'api-server',
    ];
    for (const id of removed) store.delete(`plugins.${id}`);
    // Anciens identifiants de plugins déjà abandonnés.
    store.delete('plugins.lastfm');
  },
  '>=3.12.0'(store: IStore) {
    const blockerConfig = store.get('plugins.adblocker') as TrackerBlockerConfig;
    if (blockerConfig) {
      if (!Object.values(blockers).includes(blockerConfig.blocker)) {
        blockerConfig.blocker = blockers.InPlayer;
      }
      store.set('plugins.do-not-track', blockerConfig);
      store.delete('plugins.adblocker');
    }
  },
  '>=3.10.0'(store: IStore) {
    const lyricGeniusConfig = store.get('plugins.lyrics-genius') as
      | {
          enabled?: boolean;
          romanizedLyrics?: boolean;
        }
      | undefined;

    if (lyricGeniusConfig) {
      const syncedLyricsConfig = store.get('plugins.synced-lyrics') as
        | SyncedLyricsPluginConfig
        | undefined;

      if (
        !syncedLyricsConfig ||
        syncedLyricsConfig?.enabled !== lyricGeniusConfig?.enabled
      ) {
        store.set('plugins.synced-lyrics', {
          ...syncedLyricsConfig,
          enabled: lyricGeniusConfig.enabled,
        });
      }

      store.delete('plugins.lyrics-genius');
    }
  },
  '>=2.1.0'(store: IStore) {
    const originalPreset = store.get('plugins.downloader.preset') as
      | string
      | undefined;
    if (originalPreset) {
      if (originalPreset !== 'opus') {
        store.set('plugins.downloader.selectedPreset', 'Custom');
        store.set('plugins.downloader.customPresetSetting', {
          extension: 'mp3',
          ffmpegArgs:
            (store.get('plugins.downloader.ffmpegArgs') as string[]) ??
            DefaultPresetList['mp3 (256kbps)'].ffmpegArgs,
        } satisfies Preset);
      } else {
        store.set('plugins.downloader.selectedPreset', 'Source');
        store.set('plugins.downloader.customPresetSetting', {
          extension: null,
          ffmpegArgs:
            (store.get('plugins.downloader.ffmpegArgs') as string[]) ?? [],
        } satisfies Preset);
      }
      store.delete('plugins.downloader.preset');
      store.delete('plugins.downloader.ffmpegArgs');
    }
  },
  '>=1.20.0'(store: IStore) {
    store.delete('plugins.visualizer'); // default value is now in the plugin

    if (store.get('plugins.notifications.toastStyle') === undefined) {
      const pluginOptions = store.get('plugins.notifications') || {};
      store.set('plugins.notifications', {
        ...pluginOptions,
      });
    }

    if (store.get('options.ForceShowLikeButtons')) {
      store.delete('options.ForceShowLikeButtons');
      store.set('options.likeButtons', 'force');
    }
  },
  '>=1.17.0'(store: IStore) {
    store.delete('plugins.picture-in-picture'); // default value is now in the plugin

    if (store.get('plugins.video-toggle.mode') === undefined) {
      store.set('plugins.video-toggle.mode', 'custom');
    }
  },
  '>=1.14.0'(store: IStore) {
    if (
      typeof store.get('plugins.precise-volume.globalShortcuts') !== 'object'
    ) {
      store.set('plugins.precise-volume.globalShortcuts', {});
    }

    if (store.get('plugins.hide-video-player.enabled')) {
      store.delete('plugins.hide-video-player');
      store.set('plugins.video-toggle.enabled', true);
    }
  },
  '>=1.11.0'(store: IStore) {
    if (store.get('options.resumeOnStart') === undefined) {
      store.set('options.resumeOnStart', true);
    }
  },
  '>=1.7.0'(store: IStore) {
    const enabledPlugins = store.get('plugins') as string[];
    if (!Array.isArray(enabledPlugins)) {
      console.warn('Plugins are not in array format, cannot migrate');
      return;
    }

    // Include custom options
    // oxlint-disable-next-line typescript/no-explicit-any
    const plugins: Record<string, any> = {
      adblocker: {
        enabled: true,
        cache: true,
        additionalBlockLists: [],
      },
      downloader: {
        enabled: false,
        ffmpegArgs: [], // E.g. ["-b:a", "192k"] for an audio bitrate of 192kb/s
        downloadFolder: undefined, // Custom download folder (absolute path)
      },
    };

    for (const enabledPlugin of enabledPlugins) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      plugins[enabledPlugin] = {
        ...plugins[enabledPlugin],
        enabled: true,
      };
    }

    store.set('plugins', plugins);
  },
};

// Le portable dispose d'un profil indépendant et stable dans AppData.
// Ce module est aussi importé par le preload, où electron.app est undefined.
// On calcule donc le chemin sans utiliser l'API Electron dans ce processus,
// puis on transmet le même cwd à electron-store dans les deux processus.
const roamingPath = process.env.APPDATA ??
  (process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming')
    : undefined);
const portableProfile =
  process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE && roamingPath
    ? path.join(roamingPath, 'YT Music Portable')
    : undefined;

if (portableProfile) {
  mkdirSync(portableProfile, { recursive: true });
  if (process.type === 'browser') {
    app.setPath('userData', portableProfile);
  }
}

export const store = new Store({
  ...(portableProfile ? { cwd: portableProfile } : {}),
  defaults: {
    ...defaults,
    // README: 'plugin' uses deepmerge to populate the default values, so it is not necessary to include it here
  },
  clearInvalidConfig: false,
  migrations,
});
