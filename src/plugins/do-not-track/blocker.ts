import fs, { promises } from 'node:fs';
import path from 'node:path';

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, net } from 'electron';

let blocker: ElectronBlocker | undefined;

const EASYLIST = 'https://easylist.to/easylist/easylist.txt';
const EASYPRIVACY = 'https://easylist.to/easylist/easyprivacy.txt';

export const loadTrackerBlockerEngine = async (
  session?: Electron.Session,
  cache = true,
  additionalBlockLists: string[] = [],
  disableDefaultLists: boolean | unknown[] = false,
) => {
  const disableDefaults =
    Array.isArray(disableDefaultLists)
      ? disableDefaultLists.length > 0
      : disableDefaultLists;
  const extra = additionalBlockLists.filter((url) =>
    /^https:\/\//i.test(url),
  );
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
    // L'ancien code utilisait un domaine d'exemple « organization/tb-list ».
    // Il pouvait échouer avant même d'installer le bloqueur de traqueurs.
    const next =
      !disableDefaults && extra.length === 0
        ? await ElectronBlocker.fromPrebuiltAdsAndTracking(
            fetchList,
            cachingOptions,
          )
        : await ElectronBlocker.fromLists(
            fetchList,
            [
              ...(!disableDefaults ? [EASYLIST, EASYPRIVACY] : []),
              ...extra,
            ],
          );

    if (blocker && session && blocker.isBlockingEnabled(session)) {
      blocker.disableBlockingInSession(session);
    }
    blocker = next;
    if (session) blocker.enableBlockingInSession(session);
  } catch (error) {
    console.warn('[YT Music] Listes anti-traqueurs indisponibles', error);
  }
};

export const unloadTrackerBlockerEngine = (session: Electron.Session) => {
  if (blocker?.isBlockingEnabled(session)) {
    blocker.disableBlockingInSession(session);
  }
};

export const isBlockerEnabled = (session: Electron.Session) =>
  blocker !== undefined && blocker.isBlockingEnabled(session);
