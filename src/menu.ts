import prompt from 'custom-electron-prompt';
import {
  app,
  type BrowserWindow,
  clipboard,
  dialog,
  Menu,
  type MenuItem,
  shell,
} from 'electron';
import is from 'electron-is';
import { satisfies } from 'semver';
import { languageResources } from 'virtual:i18n';
import { allPlugins } from 'virtual:plugins';

import { APPLICATION_NAME, setLanguage, t } from '@/i18n';

import * as config from './config';
import { getAllMenuTemplate, loadAllMenuPlugins } from './loader/menu';
import { restart } from './providers/app-controls';
import { checkAndInstallUpdate } from './providers/app-update';
import { createPluginMenuEntries } from './providers/plugin-menu-access';
import { startingPages } from './providers/extracted-data';
import promptOptions from './providers/prompt-options';

import packageJson from '../package.json';

export type MenuTemplate = Electron.MenuItemConstructorOptions[];

/** The SolidJS menu cannot rely on Electron's automatically toggled checked value. */
type BooleanOptionKey =
  | 'options.autoUpdates'
  | 'options.resumeOnStart'
  | 'options.removeUpgradeButton'
  | 'options.swapLikeButtonsOrder'
  | 'options.alwaysOnTop'
  | 'options.hideMenu'
  | 'options.startAtLogin'
  | 'options.trayClickPlayPause'
  | 'options.overrideUserAgent'
  | 'options.disableHardwareAcceleration'
  | 'options.restartOnConfigChanges'
  | 'options.autoResetAppCache';

const toggleBooleanOption = (key: BooleanOptionKey, item: MenuItem): boolean => {
  const enabled = !config.get(key);
  config.setMenuOption(key, enabled);
  item.checked = enabled;
  return enabled;
};

const pluginEnabledMenu = async (
  plugin: string,
  label = '',
  description?: string ,
  isNew = false,
  hasSubmenu = false,
  refreshMenu?: (() => void) ,
): Promise<Electron.MenuItemConstructorOptions> => ({
  label: label || plugin,
  id: `ytmd-plugin:${plugin}`,
  sublabel: isNew ? t('main.menu.plugins.new') : undefined,
  toolTip: description,
  type: 'checkbox',
  checked: await config.plugins.isEnabled(plugin),
  async click(item: Electron.MenuItem) {
    // The DOM menu is not a native Electron menu. An Electron checkbox can
    // return a stale checked state after a programmatic click. Always derive
    // the requested value from persisted main-process configuration.
    const currentlyEnabled = await config.plugins.isEnabled(plugin);
    const nextEnabled = !currentlyEnabled;
    config.plugins.setMenuOptions(plugin, { enabled: nextEnabled }, []);
    item.checked = nextEnabled;
    if (hasSubmenu) refreshMenu?.();
  },
});

export const refreshMenu = async (win: BrowserWindow) => {
  await setApplicationMenu(win);
  if (await config.plugins.isEnabled('in-app-menu')) {
    win.webContents.send('refresh-in-app-menu');
  }
};

export const mainMenuTemplate = async (
  win: BrowserWindow,
): Promise<MenuTemplate> => {
  const innerRefreshMenu = () => refreshMenu(win);
  const { navigationHistory } = win.webContents;
  await loadAllMenuPlugins(win);

  const allPluginsStubs = await allPlugins();

  // Un clic sur le nom du plugin doit TOUJOURS l'activer/désactiver.
  // Auparavant, les plugins munis d'un sous-menu (Ambiant/Transparent)
  // transformaient le nom en simple ouverture de sous-menu : le clic
  // ne changeait donc rien. Les réglages sont maintenant séparés.
  const availablePlugins = Object.keys(allPluginsStubs).sort((a, b) => {
    const aLabel = allPluginsStubs[a]?.name?.() ?? a;
    const bLabel = allPluginsStubs[b]?.name?.() ?? b;
    return aLabel.localeCompare(bLabel);
  });

  const pluginTemplates = getAllMenuTemplate();
  const pluginMenus = (
    await Promise.all(
      availablePlugins.map(async (id) => {
        const plugin = allPluginsStubs[id];
        const label = plugin?.name?.() ?? id;
        const enabled = await config.plugins.isEnabled(id);
        const isNew = plugin?.addedVersion
          ? satisfies(packageJson.version, plugin.addedVersion)
          : false;
        const toggle = await pluginEnabledMenu(
          id,
          label,
          plugin?.description?.() ?? undefined,
          isNew,
          false,
        );

        return createPluginMenuEntries(
          toggle,
          pluginTemplates[id],
          enabled,
          label,
        );
      }),
    )
  ).flat();

  const langResources = await languageResources();
  const availableLanguages = Object.keys(langResources);

  return [
    {
      label: t('main.menu.plugins.label'),
      submenu: [
        ...pluginMenus,
      ],
    },
    {
      label: t('main.menu.options.label'),
      submenu: [
        {
          label: 'Rechercher et installer une mise à jour',
          click() {
            void checkAndInstallUpdate(win);
          },
        },
        {
          label: t('main.menu.options.submenu.auto-update'),
          type: 'checkbox',
          checked: config.get('options.autoUpdates'),
          id: 'ytmd-option:autoUpdates',
          enabled: !(process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_FILE),
          toolTip: process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE
            ? 'Le portable se met à jour depuis les Releases ; la mise à jour automatique nécessite Windows Setup.'
            : undefined,
          click(item: MenuItem) {
            toggleBooleanOption('options.autoUpdates', item);
          },
        },
        {
          label: t('main.menu.options.submenu.resume-on-start'),
          type: 'checkbox',
          checked: config.get('options.resumeOnStart'),
          id: 'ytmd-option:resumeOnStart',
          click(item: MenuItem) {
            toggleBooleanOption('options.resumeOnStart', item);
          },
        },
        {
          label: t('main.menu.options.submenu.starting-page.label'),
          submenu: (() => {
            const subMenuArray: Electron.MenuItemConstructorOptions[] =
              Object.keys(startingPages).map((name) => ({
                label: name,
                type: 'radio',
                checked: config.get('options.startingPage') === name,
                id: `ytmd-radio:startingPage:${name}`,
                click() {
                  config.set('options.startingPage', name);
                },
              }));
            subMenuArray.unshift({
              label: t('main.menu.options.submenu.starting-page.unset'),
              type: 'radio',
              checked: config.get('options.startingPage') === '',
              id: 'ytmd-radio:startingPage:unset',
              click() {
                config.set('options.startingPage', '');
              },
            });
            return subMenuArray;
          })(),
        },
        {
          label: t('main.menu.options.submenu.visual-tweaks.label'),
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.remove-upgrade-button',
              ),
              type: 'checkbox',
              checked: config.get('options.removeUpgradeButton'),
              id: 'ytmd-option:removeUpgradeButton',
              click(item: MenuItem) {
                toggleBooleanOption('options.removeUpgradeButton', item);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.label',
              ),
              async click() {
                const output = await prompt(
                  {
                    title: t(
                      'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.label',
                    ),
                    label: t(
                      'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.prompt.label',
                    ),
                    value: config.get('options.customWindowTitle') || '',
                    type: 'input',
                    inputAttrs: {
                      type: 'text',
                      placeholder: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.prompt.placeholder',
                        {
                          applicationName: APPLICATION_NAME,
                        },
                      ),
                    },
                    width: 500,
                    ...promptOptions(),
                  },
                  win,
                );
                if (typeof output === 'string') {
                  config.setMenuOption('options.customWindowTitle', output);
                }
              },
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.label',
              ),
              submenu: [
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.default',
                  ),
                  type: 'radio',
                  checked: !config.get('options.likeButtons'),
                  id: 'ytmd-radio:likeButtons:default',
                  click() {
                    config.set('options.likeButtons', '');
                  },
                },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.force-show',
                  ),
                  type: 'radio',
                  checked: config.get('options.likeButtons') === 'force',
                  id: 'ytmd-radio:likeButtons:force',
                  click() {
                    config.set('options.likeButtons', 'force');
                  },
                },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.hide',
                  ),
                  type: 'radio',
                  checked: config.get('options.likeButtons') === 'hide',
                  id: 'ytmd-radio:likeButtons:hide',
                  click() {
                    config.set('options.likeButtons', 'hide');
                  },
                },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.swap',
                  ),
                  type: 'checkbox',
                  checked: config.get('options.swapLikeButtonsOrder'),
                  id: 'ytmd-option:swapLikeButtonsOrder',
                  click(item: MenuItem) {
                    toggleBooleanOption('options.swapLikeButtonsOrder', item);
                  },
                },
              ],
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.theme.label',
              ),
              submenu: [
                ...((config.get('options.themes')?.length ?? 0) === 0
                  ? [
                      {
                        label: t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.no-theme',
                        ),
                      },
                    ]
                  : []),
                ...(config.get('options.themes')?.map((theme: string) => ({
                  type: 'normal' as const,
                  label: theme,
                  async click() {
                    const { response } = await dialog.showMessageBox(win, {
                      type: 'question',
                      defaultId: 1,
                      title: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.remove-theme',
                      ),
                      message: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.remove-theme-message',
                        { theme },
                      ),
                      buttons: [
                        t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.button.cancel',
                        ),
                        t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.button.remove',
                        ),
                      ],
                    });

                    if (response === 1) {
                      config.set(
                        'options.themes',
                        config
                          .get('options.themes')
                          ?.filter((t) => t !== theme) ?? [],
                      );
                      await innerRefreshMenu();
                    }
                  },
                })) ?? []),
                { type: 'separator' },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.import-css-file',
                  ),
                  type: 'normal',
                  async click() {
                    const { filePaths } = await dialog.showOpenDialog(win, {
                      filters: [{ name: 'CSS Files', extensions: ['css'] }],
                      properties: ['openFile', 'multiSelections'],
                    });
                    if (filePaths.length > 0) {
                      config.set(
                        'options.themes',
                        [...new Set([...(config.get('options.themes') ?? []), ...filePaths])],
                      );
                      await innerRefreshMenu();
                    }
                  },
                },
              ],
            },
          ],
        },
        {
          label: t('main.menu.options.submenu.single-instance-lock'),
          type: 'checkbox',
          checked: app.hasSingleInstanceLock(),
          id: 'ytmd-option:singleInstanceLock',
          click(item: MenuItem) {
            if (app.hasSingleInstanceLock()) {
              app.releaseSingleInstanceLock();
            } else {
              app.requestSingleInstanceLock();
            }
            item.checked = app.hasSingleInstanceLock();
            void innerRefreshMenu();
          },
        },
        {
          label: t('main.menu.options.submenu.always-on-top'),
          type: 'checkbox',
          checked: config.get('options.alwaysOnTop'),
          id: 'ytmd-option:alwaysOnTop',
          click(item: MenuItem) {
            toggleBooleanOption('options.alwaysOnTop', item);
            win.setAlwaysOnTop(config.get('options.alwaysOnTop'));
          },
        },
        ...((is.windows() || is.linux()
          ? [
              {
                label: t('main.menu.options.submenu.hide-menu.label'),
                type: 'checkbox',
                checked: config.get('options.hideMenu'),
          id: 'ytmd-option:hideMenu',
                click(item) {
                  const hidden = toggleBooleanOption('options.hideMenu', item);
                  // Apply immediately to the SolidJS title bar, not only on restart.
                  if (!win.webContents.isDestroyed()) {
                    win.webContents.send('ytmd:set-menu-collapsed', hidden);
                  }
                  if (hidden && !config.get('options.hideMenuWarned')) {
                    dialog.showMessageBox(win, {
                      type: 'info',
                      title: t(
                        'main.menu.options.submenu.hide-menu.dialog.title',
                      ),
                      message: t(
                        'main.menu.options.submenu.hide-menu.dialog.message',
                      ),
                    });
                  }
                },
              },
            ]
          : []) satisfies Electron.MenuItemConstructorOptions[]),
        ...((is.windows() || is.macOS()
          ? // Only works on Win/Mac
            // https://www.electronjs.org/docs/api/app#appsetloginitemsettingssettings-macos-windows
            [
              {
                label: t('main.menu.options.submenu.start-at-login'),
                type: 'checkbox',
                checked: config.get('options.startAtLogin'),
          id: 'ytmd-option:startAtLogin',
                click(item) {
                  toggleBooleanOption('options.startAtLogin', item);
                },
              },
            ]
          : []) satisfies Electron.MenuItemConstructorOptions[]),
        {
          label: t('main.menu.options.submenu.tray.label'),
          submenu: [
            {
              label: t('main.menu.options.submenu.tray.submenu.disabled'),
              type: 'radio',
              checked: !config.get('options.tray'),
              click() {
                config.setMenuOption('options.tray', false);
                config.setMenuOption('options.appVisible', true);
                win.show();
              },
            },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.enabled-and-show-app',
              ),
              type: 'radio',
              checked:
                config.get('options.tray') && config.get('options.appVisible'),
              click() {
                config.setMenuOption('options.tray', true);
                config.setMenuOption('options.appVisible', true);
                win.show();
              },
            },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.enabled-and-hide-app',
              ),
              type: 'radio',
              checked:
                config.get('options.tray') && !config.get('options.appVisible'),
              click() {
                config.setMenuOption('options.tray', true);
                config.setMenuOption('options.appVisible', false);
                // Don't hide in the middle of menu dispatch. The tray icon
                // must already exist before the window disappears.
                setTimeout(() => {
                  if (!win.isDestroyed()) win.hide();
                }, 200);
              },
            },
            { type: 'separator' },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.play-pause-on-click',
              ),
              type: 'checkbox',
              checked: config.get('options.trayClickPlayPause'),
              id: 'ytmd-option:trayClickPlayPause',
              click(item: MenuItem) {
                toggleBooleanOption('options.trayClickPlayPause', item);
              },
            },
          ],
        },
        {
          label: t('main.menu.options.submenu.language.label') + ' (Language)',
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.language.submenu.to-help-translate',
              ),
              type: 'normal',
              click() {
                const url = 'https://bit.ly/48n5YF7';
                shell.openExternal(url);
              },
            } as Electron.MenuItemConstructorOptions,
          ].concat(
            availableLanguages
              .map(
                (lang): Electron.MenuItemConstructorOptions => ({
                  label: `${langResources[lang].translation.language?.name ?? 'Unknown'} (${langResources[lang].translation.language?.['local-name'] ?? 'Unknown'})`,
                  type: 'radio',
                  checked: (config.get('options.language') ?? 'en') === lang,
                  async click() {
                    if (config.get('options.language') === lang) return;
                    config.setMenuOption('options.language', lang);
                    await setLanguage(lang);
                    await refreshMenu(win);
                    // The website and pear-trans custom elements need to be
                    // re-created in the selected language.
                    setTimeout(() => {
                      if (!win.isDestroyed()) win.webContents.reload();
                    }, 300);
                  },
                }),
              )
              .sort((a, b) => a.label!.localeCompare(b.label!)),
          ),
        },
        { type: 'separator' },
        {
          label: t('main.menu.options.submenu.advanced-options.label'),
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.set-proxy.label',
              ),
              type: 'normal',
              toolTip: 'Le nouveau proxy sera appliqué au prochain démarrage de YT Music.',
              async click(item: MenuItem) {
                await setProxy(item, win);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.override-user-agent',
              ),
              type: 'checkbox',
              checked: config.get('options.overrideUserAgent'),
          id: 'ytmd-option:overrideUserAgent',
              toolTip: 'Nécessite un redémarrage de YT Music pour modifier les requêtes du navigateur.',
              click(item: MenuItem) {
                toggleBooleanOption('options.overrideUserAgent', item);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.disable-hardware-acceleration',
              ),
              type: 'checkbox',
              checked: config.get('options.disableHardwareAcceleration'),
          id: 'ytmd-option:disableHardwareAcceleration',
              toolTip: 'Nécessite un redémarrage de YT Music (Electron).',
              click(item: MenuItem) {
                toggleBooleanOption('options.disableHardwareAcceleration', item);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.restart-on-config-changes',
              ),
              type: 'checkbox',
              checked: config.get('options.restartOnConfigChanges'),
          id: 'ytmd-option:restartOnConfigChanges',
              click(item: MenuItem) {
                toggleBooleanOption('options.restartOnConfigChanges', item);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.auto-reset-app-cache',
              ),
              type: 'checkbox',
              checked: config.get('options.autoResetAppCache'),
          id: 'ytmd-option:autoResetAppCache',
              click(item: MenuItem) {
                toggleBooleanOption('options.autoResetAppCache', item);
              },
            },
            { type: 'separator' },
            is.macOS()
              ? {
                  label: t(
                    'main.menu.options.submenu.advanced-options.submenu.toggle-dev-tools',
                  ),
                  // Cannot use "toggleDevTools" role in macOS
                  click() {
                    const { webContents } = win;
                    if (webContents.isDevToolsOpened()) {
                      webContents.closeDevTools();
                    } else {
                      webContents.openDevTools();
                    }
                  },
                }
              : {
                  label: t(
                    'main.menu.options.submenu.advanced-options.submenu.toggle-dev-tools',
                  ),
                  role: 'toggleDevTools',
                },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.edit-config-json',
              ),
              click() {
                config.edit();
              },
            },
          ],
        },
      ],
    },
    {
      label: t('main.menu.view.label'),
      submenu: [
        {
          label: t('main.menu.view.submenu.reload'),
          role: 'reload',
        },
        {
          label: t('main.menu.view.submenu.force-reload'),
          role: 'forceReload',
        },
        { type: 'separator' },
        {
          label: t('main.menu.view.submenu.zoom-in'),
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+=',
          visible: false,
        },
        {
          label: t('main.menu.view.submenu.zoom-in'),
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+Plus',
        },
        {
          label: t('main.menu.view.submenu.zoom-out'),
          role: 'zoomOut',
          accelerator: 'CmdOrCtrl+-',
        },
        {
          label: t('main.menu.view.submenu.zoom-out'),
          role: 'zoomOut',
          accelerator: 'CmdOrCtrl+Shift+-',
          visible: false,
        },
        {
          label: t('main.menu.view.submenu.reset-zoom'),
          role: 'resetZoom',
        },
        { type: 'separator' },
        {
          label: t('main.menu.view.submenu.toggle-fullscreen'),
          role: 'togglefullscreen',
        },
      ],
    },
    {
      label: t('main.menu.navigation.label'),
      submenu: [
        {
          label: t('main.menu.navigation.submenu.go-back'),
          click() {
            if (navigationHistory.canGoBack()) {
              navigationHistory.goBack();
            }
          },
        },
        {
          label: t('main.menu.navigation.submenu.go-forward'),
          click() {
            if (navigationHistory.canGoForward()) {
              navigationHistory.goForward();
            }
          },
        },
        {
          label: t('main.menu.navigation.submenu.copy-current-url'),
          click() {
            const currentURL = win.webContents.getURL();
            clipboard.writeText(currentURL);
          },
        },
        {
          label: t('main.menu.navigation.submenu.restart'),
          click: restart,
        },
        {
          label: t('main.menu.navigation.submenu.quit'),
          role: 'quit',
        },
      ],
    },
    /*
    {
      label: t('main.menu.about'),
      submenu: [{ role: 'about' }],
    },
    */
  ];
};
export const setApplicationMenu = async (win: Electron.BrowserWindow) => {
  const menuTemplate: MenuTemplate = [...(await mainMenuTemplate(win))];
  if (process.platform === 'darwin') {
    const { name } = app;
    menuTemplate.unshift({
      label: name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'selectAll' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

async function setProxy(item: Electron.MenuItem, win: BrowserWindow) {
  const output = await prompt(
    {
      title: t(
        'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.title',
      ),
      label: t(
        'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.label',
      ),
      value: config.get('options.proxy'),
      type: 'input',
      inputAttrs: {
        type: 'url',
        placeholder: t(
          'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.placeholder',
        ),
      },
      width: 450,
      ...promptOptions(),
    },
    win,
  );

  if (typeof output === 'string') {
    config.setMenuOption('options.proxy', output);
    item.checked = output !== '';
  } else {
    // User pressed cancel
    item.checked = !item.checked; // Reset checkbox
  }
}
