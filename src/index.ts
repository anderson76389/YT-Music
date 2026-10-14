import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import ErrorHtmlAsset from '@assets/error.html?asset';
import {
  enhanceWebRequest,
  type BetterSession,
} from '@jellybrick/electron-better-web-request';
import { deepmerge } from 'deepmerge-ts';
import {
  BrowserWindow,
  app,
  screen,
  globalShortcut,
  session,
  dialog,
  ipcMain,
  protocol,
  type BrowserWindowConstructorOptions,
} from 'electron';
import electronDebug from 'electron-debug';
import is from 'electron-is';
import unhandled from 'electron-unhandled';
import { deepEqual } from 'fast-equals';
import { parse } from 'node-html-parser';
import { languageResources } from 'virtual:i18n';
import { allPlugins, mainPlugins } from 'virtual:plugins';

import { APP_ID } from '@/app-identity';
import * as config from '@/config';
import { loadI18n, setLanguage, t } from '@/i18n';
import {
  forceLoadMainPlugin,
  forceUnloadMainPlugin,
  getAllLoadedMainPlugins,
  loadAllMainPlugins,
} from '@/loader/main';
import { refreshMenu, setApplicationMenu } from '@/menu';
import musicPlayerCss from '@/music-player.css?inline';
import { injectCSS, injectCSSAsFile } from '@/plugins/utils/main';
import { restart, setupAppControls } from '@/providers/app-controls';
import { scheduleUpdateCheck } from '@/providers/app-update';
import {
  APP_PROTOCOL,
  handleProtocol,
  setupProtocolHandler,
} from '@/providers/protocol-handler';
import { setupSongInfo } from '@/providers/song-info';
import { setUpTray } from '@/tray';
import { LoggerPrefix } from '@/utils';
import { isTesting } from '@/utils/testing';

import type { PluginConfig } from '@/types/plugins';

// During Windows release verification, retain a detailed boot trace.
const smokeOutputPath = process.env.YTMD_SMOKE_RESULT;
const traceStartup = (stage: string, detail = '') => {
  if (!smokeOutputPath) return;
  try {
    fs.appendFileSync(smokeOutputPath + '.trace', `${new Date().toISOString()} ${stage} ${detail}\n`);
  } catch (error) {
    console.error('[YT Music] Smoke trace unavailable', error);
  }
};
traceStartup('module-loaded', process.execPath);

// Catch errors and log them
unhandled({
  logger: console.error,
  showDialog: false,
});

// Prevent window being garbage collected
let mainWindow: Electron.BrowserWindow | null;
let queuedSecondInstance: string[] | null = null;

const focusOrRouteSecondInstance = (commandLine: string[]) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    queuedSecondInstance = commandLine;
    return;
  }
  const uri = `${APP_PROTOCOL}://`;
  const protocolArgv = commandLine.find((arg) => arg.startsWith(uri));
  if (protocolArgv) {
    const lastIndex = protocolArgv.endsWith('/') ? -1 : undefined;
    const command = protocolArgv.slice(uri.length, lastIndex);
    try {
      const split = decodeURIComponent(command).split(' ');
      handleProtocol(split.shift()!, ...split);
    } catch (error) {
      console.error('[YT Music] URL de seconde instance invalide', error);
    }
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
};

// Écouter AVANT les opérations asynchrones de démarrage : sinon le clic
// sur une seconde instance peut être perdu sans afficher la première.
app.on('second-instance', (_, commandLine) => {
  focusOrRouteSecondInstance(commandLine);
});

const applyStartAtLogin = (enabled: boolean) => {
  try {
    const portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE;
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...(process.platform === 'win32' && portableExecutable
        ? { path: portableExecutable }
        : {}),
    });
  } catch (error) {
    console.error('[YT Music] Démarrage avec Windows indisponible', error);
  }
};

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'http',
    privileges: {
      standard: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
  {
    scheme: 'https',
    privileges: {
      standard: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
  { scheme: 'mailto', privileges: { standard: true } },
]);

// Ozone platform hint: Required for Wayland support
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

// SharedArrayBuffer: Required for downloader (@ffmpeg/core-mt)
// OverlayScrollbar: Required for overlay scrollbars
// UseOzonePlatform: Required for Wayland support
// WaylandWindowDecorations: Required for Wayland decorations
app.commandLine.appendSwitch(
  'enable-features',
  'OverlayScrollbar,SharedArrayBuffer,UseOzonePlatform,WaylandWindowDecorations',
);

// Disable Fluent Scrollbar (for OverlayScrollbar)
const disabledFeatures = ['FluentScrollbar'];
let disableHardwareAcceleration = config.get(
  'options.disableHardwareAcceleration',
);

// Linux specific fixes
if (is.linux()) {
  // https://github.com/electron/electron/issues/15947
  if (await config.plugins.isEnabled('transparent-player')) {
    disableHardwareAcceleration = true;
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  }

  // Overrides WM_CLASS for X11 to correspond to icon filename
  app.setName(APP_ID);
  // for wayland
  app.commandLine.appendSwitch(
    'class',
    APP_ID,
  );
}

if (disableHardwareAcceleration) {
  if (is.dev()) console.log('Disabling hardware acceleration');
  app.disableHardwareAcceleration();
}

// Apply disabled features
app.commandLine.appendSwitch('disable-features', disabledFeatures.join(','));

// Le proxy classique reste disponible, sans l'ancien plugin
// d'authentification ni ses dépendances.
if (config.get('options.proxy')) {
  const proxyToUse = config.get('options.proxy');
  console.log(LoggerPrefix, `Using proxy: ${proxyToUse}`);
  app.commandLine.appendSwitch('proxy-server', proxyToUse);
}

// Adds debug features like hotkeys for triggering dev tools and reload
electronDebug({
  showDevTools: false, // Disable automatic devTools on new window
});

let icon = 'assets/icon.png';
if (process.platform === 'win32') {
  icon = 'assets/generated/icons/win/icon.ico';
} else if (process.platform === 'darwin') {
  icon = 'assets/generated/icons/mac/icon.icns';
}

function onClosed() {
  // Dereference the window
  // For multiple Windows store them in an array
  mainWindow = null;
}

ipcMain.handle('peard:get-main-plugin-names', async () =>
  Object.keys(await mainPlugins()),
);

// In the portable edition the main and preload processes can resolve
// different electron-store locations. The main process must be the sole
// source of truth for renderer-visible preferences and plugin toggles.
ipcMain.on('ytmd:config:get', (event, key: string) => {
  event.returnValue = config.get(key as Parameters<typeof config.get>[0]);
});
ipcMain.on('ytmd:config:set', (event, key: string, value: unknown) => {
  config.set(key, value);
  event.returnValue = null;
});
ipcMain.on('ytmd:config:set-partial', (event, key: string, value: object, defaults?: object) => {
  config.setPartial(key, value, defaults);
  event.returnValue = null;
});
ipcMain.on('ytmd:config:set-menu-option', (event, key: string, value: unknown) => {
  config.setMenuOption(key, value);
  event.returnValue = null;
});
ipcMain.on('ytmd:plugins:get', (event) => {
  event.returnValue = config.plugins.getPlugins();
});
ipcMain.on('ytmd:plugins:get-options', (event, name: string) => {
  event.returnValue = config.plugins.getOptions(name);
});
ipcMain.on('ytmd:plugins:set-options',
  (event, name: string, options: Record<string, unknown>, exclude?: string[]) => {
    if (options && typeof options === 'object') {
      config.plugins.setOptions(name, options, exclude);
    }
    event.returnValue = null;
  },
);
ipcMain.on('ytmd:plugins:set-menu-options',
  (event, name: string, options: Record<string, unknown>, exclude?: string[]) => {
    if (options && typeof options === 'object') {
      config.plugins.setMenuOptions(name, options, exclude);
    }
    event.returnValue = null;
  },
);
ipcMain.on('ytmd:plugins:enable', (event, name: string) => {
  config.plugins.enable(name);
  event.returnValue = null;
});
ipcMain.on('ytmd:plugins:disable', (event, name: string) => {
  config.plugins.disable(name);
  event.returnValue = null;
});
ipcMain.handle('ytmd:plugins:is-enabled', (_, name: string) =>
  config.plugins.isEnabled(name),
);


const initHook = async (win: BrowserWindow) => {
  const allPluginStubs = await allPlugins();

  ipcMain.handle(
    'peard:get-config',
    (_, id: string) =>
      deepmerge(
        allPluginStubs[id].config ?? { enabled: false },
        config.get(`plugins.${id}`) ?? {},
      ) as PluginConfig,
  );
  ipcMain.handle('peard:set-config', (_, name: string, obj: object) =>
    config.setPartial(`plugins.${name}`, obj, allPluginStubs[name].config),
  );

  // Source de vérité : le fichier de configuration, pas le DOM.
  // L'injection Electron est faite même si le plugin renderer n'a pas démarré.
  // Cela garantit que les thèmes ne dépendent pas d'un hook du lecteur.
  type RemovePluginCss = () => Promise<void>;
  const pluginCss = new Map<string, RemovePluginCss>();
  const cssSequence = new Map<string, number>();
  const setVisualCss = async (id: string, enabled: boolean) => {
    const seq = (cssSequence.get(id) ?? 0) + 1;
    cssSequence.set(id, seq);
    const existing = pluginCss.get(id);
    if (!enabled) {
      pluginCss.delete(id);
      if (existing) await existing();
      return true;
    }
    if (existing) return true;
    const style = allPluginStubs[id]?.stylesheets?.join('\n') ?? '';
    if (!style || win.webContents.isDestroyed()) return false;
    try {
      const remove = await injectCSS(win.webContents, style);
      if (seq !== cssSequence.get(id) ||
          !await config.plugins.isEnabled(id)) {
        await remove();
        return false;
      }
      pluginCss.set(id, remove);
      return true;
    } catch (error) {
      console.error('[YT Music] Échec du CSS de', id, error);
      return false;
    }
  };

  ipcMain.handle('ytmd:plugin-css:enable', async (event, id: string) => {
    if (event.sender !== win.webContents || !allPluginStubs[id]) return false;
    return setVisualCss(id, await config.plugins.isEnabled(id));
  });
  ipcMain.handle('ytmd:plugin-css:disable', async (event, id: string) => {
    if (event.sender !== win.webContents || !allPluginStubs[id]) return false;
    return setVisualCss(id, false);
  });

  // Au premier chargement, injecter immédiatement les thèmes déjà cochés.
  for (const id of Object.keys(allPluginStubs)) {
    if (allPluginStubs[id]?.stylesheets?.length &&
        await config.plugins.isEnabled(id)) {
      void setVisualCss(id, true);
    }
  }

  win.once('closed', () => {
    for (const cleanup of pluginCss.values()) void cleanup();
    pluginCss.clear();
    ipcMain.removeHandler('ytmd:plugin-css:enable');
    ipcMain.removeHandler('ytmd:plugin-css:disable');
  });

  config.watch((newValue, oldValue) => {
    const newPluginConfigList = (newValue?.plugins ?? {}) as Record<
      string,
      unknown
    >;
    const oldPluginConfigList = (oldValue?.plugins ?? {}) as Record<
      string,
      unknown
    >;

    Object.entries(newPluginConfigList).forEach(([id, newPluginConfig]) => {
      const isEqual = deepEqual(oldPluginConfigList[id], newPluginConfig);

      if (!isEqual) {
        const def = allPluginStubs[id];
        // An old configuration can still contain extensions removed from the
        // application. One unknown id must not break all plugin changes.
        if (!def) return;
        const defaults = def.config ?? { enabled: false };
        const oldConfig = deepmerge(defaults, oldPluginConfigList[id] ?? {}) as PluginConfig;
        const config = deepmerge(defaults, newPluginConfig ?? {}) as PluginConfig;

        if (config.enabled !== oldConfig.enabled) {
          if (def.restartNeeded) {
            // Plugins installing native hooks, WebAudio nodes or shortcuts
            // cannot all be safely unloaded without a restart. Do not fake
            // a live activation while those hooks belong to the old state.
            void showNeedToRestartDialog(id);
          } else {
            if (def.stylesheets?.length) void setVisualCss(id, config.enabled);
            if (config.enabled) {
              win.webContents.send('plugin:enable', id);
              ipcMain.emit('plugin:enable', id);
              void forceLoadMainPlugin(id, win).catch(console.error);
            } else {
              win.webContents.send('plugin:unload', id);
              ipcMain.emit('plugin:unload', id);
              void forceUnloadMainPlugin(id, win).catch(console.error);
            }
          }
        }

        const mainPlugin = getAllLoadedMainPlugins()[id];
        if (mainPlugin) {
          if (config.enabled && typeof mainPlugin.backend !== 'function') {
            mainPlugin.backend?.onConfigChange?.call(
              mainPlugin.backend,
              config,
            );
          }
        }

        win.webContents.send('config-changed', id, config);
      }
    });

    if (
      !deepEqual(
        (newValue?.options as { themes?: string[] } | undefined)?.themes,
        (oldValue?.options as { themes?: string[] } | undefined)?.themes,
      )
    ) {
      syncUserThemes(win);
    }

    // Les options ci-dessous étaient seulement relues au démarrage :
    // la case changeait, mais le comportement restait inchangé.
    const nextOptions = (newValue?.options ?? {}) as Record<string, unknown>;
    const previousOptions = (oldValue?.options ?? {}) as Record<string, unknown>;
    if (nextOptions.hideMenu !== previousOptions.hideMenu) {
      const hidden = nextOptions.hideMenu === true;
      win.setAutoHideMenuBar(hidden);
      win.webContents.send('ytmd:set-menu-collapsed', hidden);
    }
    if (nextOptions.startAtLogin !== previousOptions.startAtLogin) {
      applyStartAtLogin(nextOptions.startAtLogin === true);
    }
    if (nextOptions.tray !== previousOptions.tray) {
      setUpTray(app, win);
    }
    if (nextOptions.alwaysOnTop !== previousOptions.alwaysOnTop) {
      win.setAlwaysOnTop(nextOptions.alwaysOnTop === true);
    }
    if (nextOptions.customWindowTitle !== previousOptions.customWindowTitle) {
      const customTitle = nextOptions.customWindowTitle;
      win.setTitle(typeof customTitle === 'string' && customTitle.trim()
        ? customTitle
        : win.webContents.getTitle());
    }
    if (
      nextOptions.removeUpgradeButton !== previousOptions.removeUpgradeButton ||
      nextOptions.likeButtons !== previousOptions.likeButtons ||
      nextOptions.swapLikeButtonsOrder !== previousOptions.swapLikeButtonsOrder
    ) {
      win.webContents.send('ytmd:appearance-settings-changed');
    }
    if (nextOptions.autoUpdates !== previousOptions.autoUpdates) {
      scheduleUpdateCheck(win, nextOptions.autoUpdates === true);
    }

    // Rafraîchir les cases et sous-menus après chaque changement effectif
    // d'options/plugins. Sans cela, les menus gardent des coches périmées.
    if (
      !deepEqual(newValue?.plugins, oldValue?.plugins) ||
      !deepEqual(newValue?.options, oldValue?.options)
    ) {
      void refreshMenu(win).catch((error: unknown) => {
        console.error('[YTMusic] Impossible d’actualiser le menu', error);
      });
    }
  });
};

const showNeedToRestartDialog = async (id: string) => {
  const plugin = (await allPlugins())[id];

  const dialogOptions: Electron.MessageBoxOptions = {
    type: 'info',
    buttons: [
      t('main.dialog.need-to-restart.buttons.restart-now'),
      t('main.dialog.need-to-restart.buttons.later'),
    ],
    title: t('main.dialog.need-to-restart.title'),
    message: t('main.dialog.need-to-restart.message', {
      pluginName: plugin?.name?.() ?? id,
    }),
    detail: t('main.dialog.need-to-restart.detail', {
      pluginName: plugin?.name?.() ?? id,
    }),
    defaultId: 0,
    cancelId: 1,
  };

  let dialogPromise: Promise<Electron.MessageBoxReturnValue>;
  if (mainWindow) {
    dialogPromise = dialog.showMessageBox(mainWindow, dialogOptions);
  } else {
    dialogPromise = dialog.showMessageBox(dialogOptions);
  }

  dialogPromise.then((dialogOutput) => {
    switch (dialogOutput.response) {
      case 0: {
        restart();
        break;
      }

      // Ignore
      default: {
        break;
      }
    }
  });
};

type RemoveTheme = () => Promise<void>;
const activeUserThemes = new WeakMap<
  Electron.WebContents,
  Map<string, Promise<RemoveTheme>>
>();

function syncUserThemes(win: BrowserWindow) {
  const webContents = win.webContents;
  if (webContents.isDestroyed()) return;
  const loaded = activeUserThemes.get(webContents) ?? new Map();
  activeUserThemes.set(webContents, loaded);

  const wanted = new Set(
    (config.get('options.themes') ?? []).filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    ),
  );

  for (const [filepath, remover] of loaded) {
    if (wanted.has(filepath)) continue;
    loaded.delete(filepath);
    void remover.then((remove) => remove());
  }

  for (const filepath of wanted) {
    if (loaded.has(filepath)) continue;
    if (!fs.existsSync(filepath)) {
      console.warn(
        LoggerPrefix,
        t('main.console.theme.css-file-not-found', { cssFile: filepath }),
      );
      continue;
    }
    // Le gestionnaire conserve ce style lors des navigations et recharge
    // les fichiers lors de chaque nouvelle page.
    loaded.set(filepath, injectCSSAsFile(webContents, filepath));
  }
}

function initTheme(win: BrowserWindow) {
  void injectCSS(win.webContents, musicPlayerCss);
  syncUserThemes(win);

  win.webContents.once('did-finish-load', () => {
    if (is.dev()) {
      console.debug(LoggerPrefix, t('main.console.did-finish-load.dev-tools'));
    }
  });
}

async function createMainWindow() {
  traceStartup('create-window-start');
  const windowSize = config.get('window-size');
  const windowMaximized = config.get('window-maximized');
  const windowPosition: Electron.Point = config.get('window-position');
  const useInlineMenu = await config.plugins.isEnabled('in-app-menu');
  // Sous Windows, une fenêtre Electron opaque ne peut pas devenir réellement
  // transparente simplement via des CSS ou setBackgroundColor().
  // Ce choix requiert un redémarrage, ce que signale déjà le plugin.
  const useTransparentWindow =
    (is.windows() || is.macOS() || is.linux()) &&
    (await config.plugins.isEnabled('transparent-player'));

  const defaultTitleBarOverlayOptions: Electron.TitleBarOverlay = {
    color: '#00000000',
    symbolColor: '#ffffff',
    height: 32,
  };

  const decorations: Partial<BrowserWindowConstructorOptions> = {
    frame: !is.macOS() && !useInlineMenu,
    titleBarOverlay: defaultTitleBarOverlayOptions,
    titleBarStyle: useInlineMenu
      ? 'hidden'
      : is.macOS()
        ? 'hiddenInset'
        : 'default',
    autoHideMenuBar: config.get('options.hideMenu'),
  };

  // Note: on linux, for some weird reason, having these extra properties with 'frame: false' does not work
  if (is.linux() && useInlineMenu) {
    delete decorations.titleBarOverlay;
    delete decorations.titleBarStyle;
  }

  const electronWindowSettings: Electron.BrowserWindowConstructorOptions = {
    icon,
    width: windowSize.width,
    height: windowSize.height,
    minWidth: 325,
    minHeight: 425,
    transparent: useTransparentWindow,
    backgroundColor: useTransparentWindow ? '#00000000' : '#000000',
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      ...(isTesting()
        ? undefined
        : {
            // Sandbox is only enabled in tests for now
            // See https://www.electronjs.org/docs/latest/tutorial/sandbox#preload-scripts
            sandbox: false,
          }),
    },
    ...decorations,
  };

  const win = new BrowserWindow(electronWindowSettings);
  traceStartup('window-created', String(win.id));
  if (smokeOutputPath) {
    win.webContents.on('did-start-loading', () => traceStartup('did-start-loading'));
    win.webContents.on('dom-ready', () => traceStartup('dom-ready'));
    win.webContents.on('did-finish-load', () => traceStartup('did-finish-load'));
    win.webContents.on('did-fail-load', (_event, code, desc) =>
      traceStartup('did-fail-load', String(code) + ' ' + desc));
    win.webContents.on('preload-error', (_event, filepath, error) =>
      traceStartup('preload-error', filepath + ' ' + String(error)));
    win.webContents.on('render-process-gone', (_event, details) =>
      traceStartup('render-process-gone', JSON.stringify(details)));
  }

  await initHook(win);
  traceStartup('hook-ready');
  initTheme(win);

  // Installer le multiplexeur webRequest AVANT les plugins réseau.
  // Sinon un plugin adblock peut écraser le gestionnaire des en-têtes.
  removeContentSecurityPolicy();

  await loadAllMainPlugins(win);
  traceStartup('main-plugins-loaded');

  if (windowPosition) {
    const { x: windowX, y: windowY } = windowPosition;
    const winSize = win.getSize();
    const display = screen.getDisplayNearestPoint(windowPosition);
    const primaryDisplay = screen.getPrimaryDisplay();

    const scaleFactor = is.windows()
      ? primaryDisplay.scaleFactor / display.scaleFactor
      : 1;
    const scaledWidth = Math.floor(windowSize.width * scaleFactor);
    const scaledHeight = Math.floor(windowSize.height * scaleFactor);

    const scaledX = windowX;
    const scaledY = windowY;

    if (
      scaledX + (scaledWidth / 2) < display.bounds.x - 8 || // Left
      scaledX + (scaledWidth / 2) > display.bounds.x + display.bounds.width || // Right
      scaledY < display.bounds.y - 8 || // Top
      scaledY + (scaledHeight / 2) > display.bounds.y + display.bounds.height // Bottom
    ) {
      // Window is offscreen
      if (is.dev()) {
        console.warn(
          LoggerPrefix,
          t('main.console.window.tried-to-render-offscreen', {
            windowSize: String(winSize),
            displaySize: JSON.stringify(display.bounds),
            position: JSON.stringify(windowPosition),
          }),
        );
      }
    } else {
      win.setSize(scaledWidth, scaledHeight);
      win.setPosition(scaledX, scaledY);
    }
  }

  if (windowMaximized) {
    win.maximize();
  }

  if (config.get('options.alwaysOnTop')) {
    win.setAlwaysOnTop(true);
  }

  const urlToLoad = config.get('options.resumeOnStart')
    ? config.get('url')
    : config.defaultConfig.url;
  win.on('closed', onClosed);

  win.on('move', () => {
    if (win.isMaximized()) {
      return;
    }

    const [x, y] = win.getPosition();
    lateSave('window-position', { x, y });
  });

  let winWasMaximized: boolean;

  win.on('resize', () => {
    const [width, height] = win.getSize();
    const isMaximized = win.isMaximized();

    if (winWasMaximized !== isMaximized) {
      winWasMaximized = isMaximized;
      config.set('window-maximized', isMaximized);
    }

    if (isMaximized) {
      return;
    }

    lateSave('window-size', {
      width,
      height,
    });
  });

  const savedTimeouts: Record<string, NodeJS.Timeout | undefined> = {};

  function lateSave(
    key: string,
    value: unknown,
    fn: (key: string, value: unknown) => void = config.set,
  ) {
    if (savedTimeouts[key]) {
      clearTimeout(savedTimeouts[key]);
    }

    savedTimeouts[key] = setTimeout(() => {
      fn(key, value);
      savedTimeouts[key] = undefined;
    }, 600);
  }

  app.on('render-process-gone', (_event, _webContents, details) => {
    showUnresponsiveDialog(win, details);
  });

  win.once('ready-to-show', () => {
    if (config.get('options.appVisible')) {
      win.show();
    }
  });

  win.webContents.on('dom-ready', () => {
    if (useInlineMenu && is.windows()) {
      win.setTitleBarOverlay({
        ...defaultTitleBarOverlayOptions,
        height: Math.floor(
          defaultTitleBarOverlayOptions.height! *
            win.webContents.getZoomFactor(),
        ),
      });
    }
  });
  win.webContents.on('will-redirect', (event) => {
    const url = URL.parse(event.url);

    // Workarounds for regions where YTM is restricted
    if (
      url &&
      url.hostname.endsWith('\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com') &&
      url.pathname === '/premium'
    ) {
      event.preventDefault();

      win.webContents.loadURL(
        'https://accounts.google.com/ServiceLogin?ltmpl=music&service=\u0079\u006f\u0075\u0074\u0075\u0062\u0065&continue=https%3A%2F%2Fwww.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com%2Fsignin%3Faction_handle_signin%3Dtrue%26next%3Dhttps%253A%252F%252Fmusic.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com%252F',
      );
    }
  });

  const smokeMarker = process.env.YTMD_SMOKE_RESULT;
  if (smokeMarker) {
    traceStartup('smoke-loading-local-page');
    // Exécuté par GitHub Actions avec le vrai .exe Windows, sans compte
    // Google ni accès au service distant. Confirme le démarrage d'Electron,
    // du preload, du navigateur et la disponibilité du bridge.
    win.webContents.once('did-finish-load', () => {
      void win.webContents.executeJavaScript(
        `(async () => {
          const bridgeReady = Boolean(window.mainConfig?.plugins && window.ipcRenderer?.invoke);
          if (!bridgeReady) return { bridgeReady, menuClicksPass: false, reason: 'preload-bridge-missing' };
          const getToggle = async () => {
            const menu = await window.ipcRenderer.invoke('get-menu');
            return menu?.items?.[0]?.submenu?.items?.find(
              (entry) => entry.id === 'ytmd-plugin:blur-nav-bar',
            );
          };
          let toggle;
          for (let attempt = 0; attempt < 30; attempt++) {
            try {
              toggle = await getToggle();
              if (toggle) break;
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (!toggle?.ytmdPath) {
            return { bridgeReady, menuClicksPass: false, reason: 'menu-plugin-path-missing' };
          }
          const before = await window.mainConfig.plugins.isEnabled('blur-nav-bar');
          const clicked = await window.ipcRenderer.invoke('peard:menu-event', toggle.ytmdPath);
          const after = await window.mainConfig.plugins.isEnabled('blur-nav-bar');
          const updatedToggle = await getToggle();
          const mainAfter = updatedToggle?.checked;
          const restored = updatedToggle?.ytmdPath
            ? await window.ipcRenderer.invoke('peard:menu-event', updatedToggle.ytmdPath)
            : false;
          const final = await window.mainConfig.plugins.isEnabled('blur-nav-bar');
          return {
            bridgeReady,
            menuClicksPass: clicked === true && after !== before &&
              restored === true && final === before,
            clicked, before, after, mainAfter, restored, final,
          };
        })()`,
        true,
      ).then((result: {
        bridgeReady: boolean;
        menuClicksPass: boolean;
        reason?: string;
      }) => {
        traceStartup('bridge-and-menu', JSON.stringify(result));
        fs.writeFileSync(smokeMarker, JSON.stringify({
          ...result,
          portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
          windowCreated: true,
        }));
        app.exit(result.bridgeReady && result.menuClicksPass ? 0 : 2);
      }).catch((error: unknown) => {
        fs.writeFileSync(smokeMarker, JSON.stringify({ bridgeReady: false, error: String(error) }));
        app.exit(3);
      });
    });
    // Charger une vraie page file:// : certaines versions d'Electron
    // n'exposent pas le preload/contextBridge aux documents data:.
    void win.webContents.loadFile(ErrorHtmlAsset);
  } else {
    void win.webContents.loadURL(urlToLoad);
  }

  return win;
}

app.once('browser-window-created', (_event, win) => {
  if (config.get('options.overrideUserAgent')) {
    // User agents are from https://developers.whatismybrowser.com/useragents/explore/
    const originalUserAgent = win.webContents.userAgent;
    const userAgents = {
      mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36',
      windows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36',
      linux:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36',
    };

    const updatedUserAgent = is.macOS()
      ? userAgents.mac
      : is.windows()
        ? userAgents.windows
        : userAgents.linux;

    win.webContents.userAgent = updatedUserAgent;
    app.userAgentFallback = updatedUserAgent;

    win.webContents.session.webRequest.onBeforeSendHeaders((details, cb) => {
      // This will only happen if login failed, and "retry" was pressed
      if (
        win.webContents.getURL().startsWith('https://accounts.google.com') &&
        details.url.startsWith('https://accounts.google.com')
      ) {
        details.requestHeaders['User-Agent'] = originalUserAgent;
      }

      cb({ requestHeaders: details.requestHeaders });
    });
  }

  setupSongInfo(win);
  setupAppControls();

  win.webContents.on(
    'did-fail-load',
    (
      _event,
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
      frameProcessId,
      frameRoutingId,
    ) => {
      const log = JSON.stringify(
        {
          error: 'did-fail-load',
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
          frameProcessId,
          frameRoutingId,
        },
        null,
        '\t',
      );
      if (is.dev()) {
        console.log(log);
      }

      if (
        errorCode !== -3 &&
        // Workaround for #2435
        !URL.parse(validatedURL)?.hostname?.includes('doubleclick.net')
      ) {
        // -3 is a false positive
        win.webContents.send('log', log);
        win.webContents.loadFile(ErrorHtmlAsset);
      }
    },
  );

  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });

  // The title can be enabled, edited or cleared without restarting.
  win.on('page-title-updated', (event) => {
    const customTitle = config.get('options.customWindowTitle');
    if (customTitle) {
      event.preventDefault();
      win.setTitle(customTitle);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }

  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    mainWindow = await createMainWindow();
  } else if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
});

const getDefaultLocale = async (locale: string) =>
  Object.keys(await languageResources()).includes(locale) ? locale : null;

app.whenReady().then(async () => {
  traceStartup('app-when-ready');
  if (!config.get('options.language')) {
    const locale = await getDefaultLocale(app.getLocale());
    if (locale) {
      config.set('options.language', locale);
    }
  }

  await loadI18n().then(async () => {
    await setLanguage(config.get('options.language') ?? 'en');
    console.log(LoggerPrefix, t('main.console.i18n.loaded'));
  });

  if (config.get('options.autoResetAppCache')) {
    // Clear cache after 20s
    const clearCacheTimeout = setTimeout(() => {
      if (is.dev()) {
        console.log(
          LoggerPrefix,
          t('main.console.when-ready.clearing-cache-after-20s'),
        );
      }

      session.defaultSession.clearCache();
      clearTimeout(clearCacheTimeout);
    }, 20_000);
  }

  // Garder l'identité Windows stable sans modifier les raccourcis existants.
  // Leur création/suppression appartient exclusivement à NSIS. Sinon la
  // version portable écrase le raccourci de la version installée et le rend
  // invalide au prochain déplacement du .exe.
  if (is.windows()) {
    app.setAppUserModelId(APP_ID);
  }

  ipcMain.on('get-renderer-script', (event) => {
    // Inject index.html file as string using insertAdjacentHTML
    // In dev mode, get string from process.env.VITE_DEV_SERVER_URL, else use fs.readFileSync
    if (is.dev() && process.env.ELECTRON_RENDERER_URL) {
      // HACK: to make vite work with electron renderer (supports hot reload)
      event.returnValue = [
        null,
        `
        console.log('${LoggerPrefix}', 'Loading vite from dev server');
        (async () => {
          await new Promise((resolve) => {
            if (document.readyState === 'loading') {
              console.log('${LoggerPrefix}', 'Waiting for DOM to load');
              document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
            } else {
              resolve();
            }
          });
          const viteScript = document.createElement('script');
          viteScript.type = 'module';
          viteScript.src = '${process.env.ELECTRON_RENDERER_URL}/@vite/client';
          const rendererScript = document.createElement('script');
          rendererScript.type = 'module';
          rendererScript.src = '${process.env.ELECTRON_RENDERER_URL}/renderer.ts';
          document.body.appendChild(viteScript);
          document.body.appendChild(rendererScript);
        })();
        0
      `,
      ];
    } else {
      const rendererPath = path.join(__dirname, '..', 'renderer');
      const indexHTML = parse(
        fs.readFileSync(path.join(rendererPath, 'index.html'), 'utf-8'),
      );
      const scriptSrc = indexHTML.querySelector('script')!;
      const scriptPath = path.join(
        rendererPath,
        scriptSrc.getAttribute('src')!,
      );
      const scriptString = fs.readFileSync(scriptPath, 'utf-8');
      event.returnValue = [
        url.pathToFileURL(scriptPath).toString(),
        scriptString + ';0',
      ];
    }
  });

  mainWindow = await createMainWindow();
  traceStartup('main-window-factory-finished');
  await setApplicationMenu(mainWindow);
  traceStartup('application-menu-ready');
  await refreshMenu(mainWindow);
  setUpTray(app, mainWindow);

  setupProtocolHandler(mainWindow);

  if (queuedSecondInstance) {
    const pending = queuedSecondInstance;
    queuedSecondInstance = null;
    focusOrRouteSecondInstance(pending);
  }

  // Portable launcher must not register its temporary extracted binary.
  applyStartAtLogin(config.get('options.startAtLogin'));

  // Vérification contre le manifeste SHA512 de notre propre GitHub.
  // Elle ne télécharge et n'installe rien sans accord explicite.
  scheduleUpdateCheck(mainWindow!, config.get('options.autoUpdates'));

  if (config.get('options.hideMenu') && !config.get('options.hideMenuWarned')) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: t('main.dialog.hide-menu-enabled.title'),
      message: t('main.dialog.hide-menu-enabled.message'),
    });
    config.set('options.hideMenuWarned', true);
  }

  // Optimized for Mac OS X
  if (is.macOS() && !config.get('options.appVisible')) {
    app.dock?.hide();
  }

  let forceQuit = false;
  app.on('before-quit', () => {
    forceQuit = true;
  });

  mainWindow.on('close', (event) => {
    // The tray can be turned on/off while the window is open.
    if (!forceQuit && (is.macOS() || config.get('options.tray'))) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
});

function showUnresponsiveDialog(
  win: BrowserWindow,
  details: Electron.RenderProcessGoneDetails,
) {
  if (details) {
    console.error(
      LoggerPrefix,
      t('main.console.unresponsive.details', {
        error: JSON.stringify(details, null, '\t'),
      }),
    );
  }

  dialog
    .showMessageBox(win, {
      type: 'error',
      title: t('main.dialog.unresponsive.title'),
      message: t('main.dialog.unresponsive.message'),
      detail: t('main.dialog.unresponsive.detail'),
      buttons: [
        t('main.dialog.unresponsive.buttons.wait'),
        t('main.dialog.unresponsive.buttons.relaunch'),
        t('main.dialog.unresponsive.buttons.quit'),
      ],
      cancelId: 0,
    })
    .then((result) => {
      switch (result.response) {
        case 1: {
          restart();
          break;
        }

        case 2: {
          app.quit();
          break;
        }
      }
    });
}

function removeContentSecurityPolicy(
  betterSession: BetterSession = session.defaultSession as BetterSession,
) {
  // Allows defining multiple "onHeadersReceived" listeners
  // by enhancing the session.
  // Some plugins (e.g. adblocker) also define a "onHeadersReceived" listener
  enhanceWebRequest(betterSession);

  // Custom listener to tweak the content security policy
  betterSession.webRequest.onHeadersReceived((details, callback) => {
    details.responseHeaders ??= {};

    // prettier-ignore
    if (URL.parse(details.url)?.protocol === 'https:') {
      // Remove the content security policy
      delete details.responseHeaders['content-security-policy-report-only'];
      delete details.responseHeaders['Content-Security-Policy-Report-Only'];
      delete details.responseHeaders['content-security-policy'];
      delete details.responseHeaders['Content-Security-Policy'];

      if (
        !details.responseHeaders['access-control-allow-origin'] &&
        !details.responseHeaders['Access-Control-Allow-Origin']
      ) {
        details.responseHeaders['access-control-allow-origin'] = ['https://music.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com'];
      }
    }

    callback({ cancel: false, responseHeaders: details.responseHeaders });
  });

  // When multiple listeners are defined, apply them all
  betterSession.webRequest.setResolver(
    'onHeadersReceived',
    async (listeners) => {
      return listeners.reduce(
        async (accumulator, listener) => {
          const acc = await accumulator;
          if (acc.cancel) {
            return acc;
          }

          const result = await listener.apply();
          return { ...acc, ...result };
        },
        Promise.resolve({ cancel: false }),
      );
    },
  );
}
