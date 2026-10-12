import fs from 'node:fs';

type Unregister = () => Promise<void>;
type Entry = {
  load(): string;
  key?: string;
  serial: number;
  disposed: boolean;
};
type Registry = {
  entries: Set<Entry>;
  refresh(): void;
};

const registries = new WeakMap<Electron.WebContents, Registry>();

/**
 * Une injection insertCSS appartient au document courant : après navigation,
 * elle doit être rejouée. L'ancien état global 'isLoaded' empêchait cette
 * réinjection et provoquait la disparition de certains thèmes.
 */
function getRegistry(webContents: Electron.WebContents): Registry {
  const existing = registries.get(webContents);
  if (existing) return existing;

  const entries = new Set<Entry>();
  const registry: Registry = {
    entries,
    refresh: () => {
      for (const entry of entries) {
        void apply(entry, webContents);
      }
    },
  };
  registries.set(webContents, registry);
  webContents.on('did-finish-load', registry.refresh);
  webContents.once('destroyed', () => {
    for (const entry of entries) {
      entry.disposed = true;
      entry.serial++;
    }
    entries.clear();
    webContents.removeListener('did-finish-load', registry.refresh);
    registries.delete(webContents);
  });
  return registry;
}

async function apply(entry: Entry, webContents: Electron.WebContents) {
  if (entry.disposed || webContents.isDestroyed()) return;
  const serial = ++entry.serial;
  try {
    const css = entry.load();
    const key = await webContents.insertCSS(css, { cssOrigin: 'user' });
    if (entry.disposed || serial !== entry.serial) {
      if (!webContents.isDestroyed()) {
        await webContents.removeInsertedCSS(key).catch(() => {});
      }
      return;
    }
    const prior = entry.key;
    entry.key = key;
    if (prior && prior !== key) {
      await webContents.removeInsertedCSS(prior).catch(() => {});
    }
  } catch (error) {
    console.warn('[YT Music] Impossible d’appliquer le thème CSS', error);
  }
}

async function register(
  webContents: Electron.WebContents,
  load: () => string,
): Promise<Unregister> {
  const registry = getRegistry(webContents);
  const entry: Entry = { load, serial: 0, disposed: false };
  registry.entries.add(entry);

  // Si le document est déjà prêt, le CSS s'applique immédiatement.
  // Sinon l'écouteur permanent s'en occupe au premier did-finish-load.
  if (!webContents.isLoadingMainFrame() && webContents.getURL()) {
    void apply(entry, webContents);
  }

  return async () => {
    entry.disposed = true;
    entry.serial++;
    registry.entries.delete(entry);
    const key = entry.key;
    entry.key = undefined;
    if (key && !webContents.isDestroyed()) {
      await webContents.removeInsertedCSS(key).catch(() => {});
    }
  };
}

export const injectCSS = (
  webContents: Electron.WebContents,
  css: string,
): Promise<Unregister> => register(webContents, () => css);

export const injectCSSAsFile = (
  webContents: Electron.WebContents,
  filepath: string,
): Promise<Unregister> =>
  register(webContents, () => fs.readFileSync(filepath, 'utf-8'));
