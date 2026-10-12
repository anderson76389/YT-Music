import type { App, BrowserWindow, MenuItem, WebContents } from 'electron';

/**
 * Les menus DOM ne sont pas des menus Electron natifs : Electron ne coche pas
 * automatiquement les cases et n'exécute pas les rôles natifs à leur place.
 */
export function dispatchMenuEvent(
  target: MenuItem | null,
  window: BrowserWindow | null,
  sender: WebContents,
  application: Pick<App, 'quit'>,
): boolean {
  if (!target || !target.enabled || !target.visible) return false;
  if (target.type === 'submenu' || target.type === 'separator') return false;

  if (target.type === 'checkbox') {
    target.checked = !target.checked;
  } else if (target.type === 'radio') {
    target.checked = true;
  }

  // Une commande avec click() doit recevoir le vrai MenuItem, et non undefined :
  // de nombreux plugins accèdent à item.checked dans leur callback.
  const click = target.click as
    | ((
        menuItem: MenuItem,
        browserWindow: BrowserWindow | null,
        webContents: WebContents,
      ) => void)
    | undefined;

  if (typeof click === 'function') {
    click(target, window, sender);
    return true;
  }

  // Les rôles Electron sont automatiques dans les menus natifs, mais pas dans
  // le panneau personnalisé HTML/SolidJS.
  const role = target.role?.toLowerCase();
  const wc = window?.webContents ?? sender;
  switch (role) {
    case 'reload':
      wc.reload();
      return true;
    case 'forcereload':
      wc.reloadIgnoringCache();
      return true;
    case 'zoomin':
      wc.setZoomLevel(wc.getZoomLevel() + 0.5);
      return true;
    case 'zoomout':
      wc.setZoomLevel(wc.getZoomLevel() - 0.5);
      return true;
    case 'resetzoom':
      wc.setZoomLevel(0);
      return true;
    case 'togglefullscreen':
      if (!window) return false;
      window.setFullScreen(!window.isFullScreen());
      return true;
    case 'toggledevtools':
      wc.toggleDevTools();
      return true;
    case 'quit':
      application.quit();
      return true;
    default:
      return false;
  }
}
