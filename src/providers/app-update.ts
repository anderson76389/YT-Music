import { app, dialog, shell, type BrowserWindow } from 'electron';
import updaterPackage from 'electron-updater';
import { gt, valid } from 'semver';

import { RELEASES_FEED, RELEASES_URL } from '@/app-identity';

const updater = updaterPackage.autoUpdater;
let initialized = false;
let busy = false;

export function isVersionNewer(currentVersion: string, remoteVersion: string) {
  return Boolean(
    valid(currentVersion) &&
    valid(remoteVersion) &&
    gt(remoteVersion, currentVersion),
  );
}

function isPortableWindows() {
  // Défini automatiquement par electron-builder pour l'exécutable portable.
  return process.platform === 'win32' &&
    Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

function prepareUpdater() {
  if (initialized) return;
  initialized = true;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.disableDifferentialDownload = true;
  updater.setFeedURL(RELEASES_FEED);
}

async function showMessage(
  win: BrowserWindow,
  title: string,
  message: string,
  detail?: string,
) {
  await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['OK'],
    title,
    message,
    detail,
  });
}

export async function checkAndInstallUpdate(
  win: BrowserWindow,
  options: { silent?: boolean } = {},
): Promise<void> {
  if (busy || win.isDestroyed()) return;

  if (!app.isPackaged) {
    if (!options.silent) {
      await showMessage(
        win,
        'Mise à jour YT Music',
        'Les mises à jour intégrées sont disponibles dans la version installée.',
      );
    }
    return;
  }

  if (isPortableWindows()) {
    if (options.silent) return;
    const { response } = await dialog.showMessageBox(win, {
      title: 'Mise à jour YT Music Portable',
      message: 'Le portable ne peut pas remplacer son propre fichier pendant son exécution.',
      detail:
        'Pour des mises à jour intégrées et automatiques, utilise Windows Setup. ' +
        'La nouvelle édition portable reste téléchargeable depuis tes Releases.',
      type: 'info',
      buttons: ['Voir les dernières versions', 'Annuler'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) await shell.openExternal(RELEASES_URL);
    return;
  }

  busy = true;
  try {
    prepareUpdater();
    const result = await updater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (!latest || !isVersionNewer(app.getVersion(), latest)) {
      if (!options.silent) {
        await showMessage(
          win,
          'YT Music est à jour',
          `Version installée : ${app.getVersion()}`,
        );
      }
      return;
    }

    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Mise à jour YT Music',
      message: `La version ${latest} est disponible.`,
      detail:
        'YT Music va télécharger et vérifier le nouvel installateur, puis ' +
        'installer la mise à jour dans le dossier actuel. ' +
        'Les préférences et les raccourcis seront conservés.',
      buttons: ['Mettre à jour', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return;

    const progress = (data: { percent: number }) => {
      if (!win.isDestroyed()) {
        win.setProgressBar(Math.max(0, Math.min(1, data.percent / 100)));
      }
    };
    updater.on('download-progress', progress);
    try {
      await updater.downloadUpdate();
    } finally {
      updater.removeListener('download-progress', progress);
      if (!win.isDestroyed()) win.setProgressBar(-1);
    }

    const done = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Mise à jour téléchargée',
      message: 'Installer la nouvelle version maintenant ?',
      detail:
        'YT Music va se fermer, appliquer la mise à jour puis se relancer.',
      buttons: ['Installer et redémarrer', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    });
    if (done.response === 0) {
      updater.quitAndInstall(false, true);
    }
  } catch (error) {
    console.error('[YT Music] Mise à jour impossible', error);
    if (!options.silent && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Échec de la mise à jour',
        message: 'YT Music n’a pas pu installer la nouvelle version.',
        detail:
          `${String(error)}\n\nTu peux utiliser la Release officielle de ton dépôt : ${RELEASES_URL}`,
        buttons: ['OK'],
      });
    }
  } finally {
    busy = false;
  }
}

/** Une vérification programmée maximum par fenêtre, annulée si l'option change. */
const pendingChecks = new WeakMap<BrowserWindow, ReturnType<typeof setTimeout>>();
const closeListeners = new WeakSet<BrowserWindow>();

export function scheduleUpdateCheck(win: BrowserWindow, enabled: boolean) {
  const previous = pendingChecks.get(win);
  if (previous) clearTimeout(previous);
  pendingChecks.delete(win);
  if (!enabled || isPortableWindows() || !app.isPackaged || win.isDestroyed()) return;
  const id = setTimeout(() => {
    pendingChecks.delete(win);
    if (!win.isDestroyed()) {
      void checkAndInstallUpdate(win, { silent: true });
    }
  }, 15000);
  pendingChecks.set(win, id);
  if (!closeListeners.has(win)) {
    closeListeners.add(win);
    win.once('closed', () => {
      const pending = pendingChecks.get(win);
      if (pending) clearTimeout(pending);
      pendingChecks.delete(win);
    });
  }
}
