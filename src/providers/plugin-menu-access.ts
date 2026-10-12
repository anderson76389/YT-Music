import type { MenuItemConstructorOptions } from 'electron';

/**
 * Fournit deux accès à la même liste de plugins : le bouton supérieur
 * « Plugins » et « Paramètres → Plugins ».
 *
 * Les deux menus sont reconstruits ensemble depuis la configuration réelle,
 * pour ne pas avoir un état différent entre la barre et les paramètres.
 */
export function createPluginMenuAccess(
  items: MenuItemConstructorOptions[],
  label: string,
): {
  toolbar: MenuItemConstructorOptions;
  settings: MenuItemConstructorOptions;
} {
  return {
    toolbar: { label, submenu: items },
    settings: { label, submenu: items },
  };
}
