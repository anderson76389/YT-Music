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

/** Extrait les plugins visuels de la même liste triée que le menu général. */
export function selectPluginMenuItems(
  orderedIds: string[],
  items: MenuItemConstructorOptions[],
  wantedIds: string[],
): MenuItemConstructorOptions[] {
  const lookup = new Map<string, MenuItemConstructorOptions | undefined>(
    orderedIds.map((id, index): [string, MenuItemConstructorOptions | undefined] => [
      id,
      items[index],
    ]),
  );
  return wantedIds.flatMap((id) => {
    const item = lookup.get(id);
    return item ? [item] : [];
  });
}
