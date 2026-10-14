import type { Menu, MenuItem } from 'electron';

/** Serializable menu data for the SolidJS titlebar.
 * Never depend on Electron's internal commandId surviving JSON.stringify.
 */
export type MenuSnapshotItem = {
  ytmdPath: string;
  id: string;
  label: string;
  type: MenuItem['type'];
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  commandId?: number;
  sublabel?: string;
  toolTip?: string;
  submenu?: { items: MenuSnapshotItem[] };
};

export type MenuSnapshot = { items: MenuSnapshotItem[] };

type MenuLike = Pick<Menu, 'items'>;

export function snapshotMenu(menu: MenuLike | null): MenuSnapshot {
  const serialize = (items: MenuItem[], prefix: string): MenuSnapshotItem[] =>
    items.map((item, index) => {
      const ytmdPath = prefix ? `${prefix}/${index}` : String(index);
      return {
        ytmdPath,
        id: item.id,
        label: item.label,
        type: item.type,
        enabled: item.enabled,
        visible: item.visible,
        checked: item.checked,
        commandId: item.commandId,
        sublabel: item.sublabel,
        toolTip: item.toolTip,
        ...(item.submenu
          ? { submenu: { items: serialize(item.submenu.items, ytmdPath) } }
          : {}),
      };
    });
  return { items: serialize(menu?.items ?? [], '') };
}

/** Path segments address the native menu currently shown in the titlebar. */
export function getMenuItemByPath(
  menu: MenuLike | null,
  menuPath: string,
): MenuItem | null {
  if (typeof menuPath !== 'string' ||
      !/^(0|[1-9][0-9]*)(\/(0|[1-9][0-9]*))*$/.test(menuPath)) {
    return null;
  }
  let items = menu?.items ?? [];
  let found: MenuItem | undefined;
  for (const segment of menuPath.split('/')) {
    const index = Number(segment);
    if (!Number.isSafeInteger(index)) return null;
    found = items[index];
    if (!found) return null;
    items = found.submenu?.items ?? [];
  }
  return found ?? null;
}
