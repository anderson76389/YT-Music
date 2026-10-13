import type { MenuItemConstructorOptions } from 'electron';

/**
 * Le libellé principal d'un plugin doit être un interrupteur (checkbox),
 * pas un sous-menu sans effet. Les réglages secondaires sont optionnels.
 * Aucun accès dupliqué dans le menu Paramètres.
 */
export function createPluginMenuEntries(
  toggle: MenuItemConstructorOptions,
  settings: MenuItemConstructorOptions[] | undefined,
  isEnabled: boolean,
  label: string,
): MenuItemConstructorOptions[] {
  if (!isEnabled || !settings?.length) return [toggle];

  return [
    toggle,
    {
      label: `${label} — Réglages`,
      submenu: settings,
    },
  ];
}
