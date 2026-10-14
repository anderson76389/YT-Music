import is from 'electron-is';

import { createBackend } from '@/utils';

import {
  MaterialType,
  WINDOWS_MATERIALS,
  MACOS_MATERIALS,
  type TransparentPlayerConfig,
} from './types';

import type { BackendContext } from '@/types/contexts';
import type { BrowserWindow } from 'electron';

const setWindowTransparency = (window: BrowserWindow, material: MaterialType, opacity: number) => {
  // Some Windows editions do not support Mica; it must not abort the plugin.
  try {
    if (is.windows()) {
      if (WINDOWS_MATERIALS.includes(material)) {
        window.setBackgroundMaterial(
          material as Parameters<BrowserWindow['setBackgroundMaterial']>[0],
        );
      } else {
        window.setBackgroundMaterial('none');
      }
    } else if (is.macOS()) {
      if (MACOS_MATERIALS.includes(material)) {
        window.setVibrancy(
          material as Parameters<BrowserWindow['setVibrancy']>[0],
        );
      } else {
        window.setVibrancy(null);
      }
    }
  } catch (error) {
    console.warn('[YT Music] Matériau système non disponible', error);
  }
  // Restore Pear Desktop's native transparency handling.
  window.setBackgroundColor(`rgba(0, 0, 0, ${opacity})`);
};

export const backend = createBackend({
  window: null as BrowserWindow | null,
  async start({ window, getConfig }: BackendContext<TransparentPlayerConfig>) {
    const config = await getConfig();
    this.window = window;
    setWindowTransparency(window, config.type, config.opacity);
  },
  onConfigChange(newConfig) {
    if (!this.window) return;
    setWindowTransparency(this.window, newConfig.type, newConfig.opacity);
  },
  stop({ window }) {
    setWindowTransparency(window, MaterialType.NONE, 1);
    this.window = null;
  },
});
