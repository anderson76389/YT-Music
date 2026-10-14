import {
  app,
  BrowserWindow,
  Menu,
  type MenuItem,
  ipcMain,
  nativeImage,
} from 'electron';
import { register } from 'electron-localshortcut';

import { setApplicationMenu } from '@/menu';

import { dispatchMenuEvent } from './menu-dispatch';
import { getMenuItemByPath, snapshotMenu } from './menu-snapshot';

import type { InAppMenuConfig } from './constants';
import type { BackendContext } from '@/types/contexts';

export const onMainLoad = ({
  window: win,
  ipc: { handle, send },
}: BackendContext<InAppMenuConfig>) => {
  win.on('close', () => {
    send('close-all-in-app-menu-panel');
  });

  win.once('ready-to-show', () => {
    register(win, '`', () => {
      send('toggle-in-app-menu');
    });
  });

  // Every option gets a stable, explicit path within this menu snapshot.
  // Electron commandId is not guaranteed to survive JSON serialization or
  // repeated Menu.buildFromTemplate() calls.
  handle('get-menu', () => snapshotMenu(Menu.getApplicationMenu()));

  const getMenuItemById = (commandId: number): MenuItem | null => {
    const menu = Menu.getApplicationMenu();

    let target: MenuItem | null = null;
    const stack = [...(menu?.items ?? [])];
    while (stack.length > 0) {
      const now = stack.shift();
      now?.submenu?.items.forEach((item) => stack.push(item));

      if (now?.commandId === commandId) {
        target = now;
        break;
      }
    }

    return target;
  };

  ipcMain.handle('peard:menu-event', async (event, menuPath: string) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow !== win || !menuPath) return false;
    const triggered = await dispatchMenuEvent(
      getMenuItemByPath(Menu.getApplicationMenu(), menuPath),
      senderWindow,
      event.sender,
      app,
    );
    if (!triggered) return false;

    // IMPORTANT : reconstruire la source de vérité depuis les préférences
    // APRÈS le clic, avant de renvoyer l'état au menu personnalisé.
    // Sinon la barre SolidJS affiche des coches périmées ou absentes.
    if (senderWindow && !senderWindow.isDestroyed()) {
      await setApplicationMenu(senderWindow);
      senderWindow.webContents.send('refresh-in-app-menu');
    }
    return true;
  });

  handle('get-menu-by-id', (commandId: number) => {
    const result = getMenuItemById(commandId);

    return JSON.parse(
      JSON.stringify(result, (key: string, value: unknown) =>
        key !== 'commandsMap' && key !== 'menu' ? value : undefined,
      ),
    );
  });

  handle('window-is-maximized', () => win.isMaximized());

  handle('window-close', () => win.close());
  handle('window-minimize', () => win.minimize());
  handle('window-maximize', () => win.maximize());
  win.on('maximize', () => send('window-maximize'));
  handle('window-unmaximize', () => win.unmaximize());
  win.on('unmaximize', () => send('window-unmaximize'));

  handle('image-path-to-data-url', (imagePath: string) => {
    const nativeImageIcon = nativeImage.createFromPath(imagePath);
    return nativeImageIcon?.toDataURL();
  });
};
