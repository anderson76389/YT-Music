import fs, { promises } from 'node:fs';
import path from 'node:path';

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, net } from 'electron';

import { buildTrackerListSources } from './policy';

let blocker: ElectronBlocker | undefined;

export const loadTrackerBlockerEngine = async (
  session: Electron.Session,
  cache = true,
  additionalBlockLists: string[] = [],
  disableDefaultLists: boolean | unknown[] = false,
) => {
  const sources = buildTrackerListSources(
    additionalBlockLists,
    disableDefaultLists,
  );
  const { disableDefaults, extra, urls } = sources;
  const cacheDirectory = path.join(app.getPath('userData'), 'tb_cache');
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const cachingOptions =
    cache && !extra.length && !disableDefaults
      ? {
          path: path.join(cacheDirectory, 'tb-engine.bin'),
          read: promises.readFile,
          write: promises.writeFile,
        }
      : undefined;

  const fetchList = (url: string) => net.fetch(url);
  try {
    // Seules les règles réseau sont nécessaires au filtrage du suivi.
    // Éviter les hooks cosmétiques IPC incompatibles avec le multiplexeur
    // webRequest utilisé par YT Music, tout en conservant EasyPrivacy/EasyList.
    const next = await ElectronBlocker.fromLists(
      fetchList,
      urls,
      { loadCosmeticFilters: false },
      cachingOptions,
    );

    if (next.getFilters().networkFilters.length === 0) {
      throw new Error('Aucune règle réseau de blocage chargée');
    }

    // Keep the previous working engine until the replacement is ready.
    if (blocker?.isBlockingEnabled(session)) {
      blocker.disableBlockingInSession(session);
    }
    blocker = next;
    blocker.enableBlockingInSession(session);
    if (!blocker.isBlockingEnabled(session)) {
      throw new Error('Le filtrage de la session Electron n’a pas pu démarrer');
    }
    console.info('[YT Music] Ne pas traquer : filtrage réseau Ghostery actif');
  } catch (error) {
    console.error(
      '[YT Music] Ne pas traquer : filtrage réseau NON ACTIF. Vérifier les listes et la connexion.',
      error,
    );
    // Do not quietly report a successfully started plugin when no blocking
    // engine is installed. The caller can surface this in Electron logs.
    throw error;
  }
};

export const unloadTrackerBlockerEngine = (session: Electron.Session) => {
  if (blocker?.isBlockingEnabled(session)) {
    blocker.disableBlockingInSession(session);
  }
};

export const isBlockerEnabled = (session: Electron.Session) =>
  blocker !== undefined && blocker.isBlockingEnabled(session);
