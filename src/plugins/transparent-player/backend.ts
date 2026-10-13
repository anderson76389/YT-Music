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

export const setWindowTransparency = (
  window: BrowserWindow,
  material: MaterialType,
  opacity: number,
) => {
  const transparency = Math.max(0.1, Math.min(1, opacity));
  // L'opacité est gérée par les couleurs RGBA du rendu HTML. Même à 100 %,
  // l'arrière-plan de la fenêtre ne doit pas redevenir noir opaque.
  void transparency;

  // Le matériau OS est facultatif (Mica nécessite une version Windows
  // compatible). La fenêtre Electron est déjà créée avec transparent: true
  // dans src/index.ts lorsque le plugin est activé au lancement.
  try {
    if (is.windows()) {
      window.setBackgroundMaterial(
        WINDOWS_MATERIALS.includes(material)
          ? (material as Parameters<BrowserWindow['setBackgroundMaterial']>[0])
          : 'none',
      );
    } else if (is.macOS()) {
      window.setVibrancy(
        MACOS_MATERIALS.includes(material)
          ? (material as Parameters<BrowserWindow['setVibrancy']>[0])
          : null,
      );
    }
  } catch (error) {
    console.warn('[YT Music] Matériau système non disponible', error);
  }

  // L'opacité visuelle est pilotée par le CSS du contenu. Ne jamais redonner
  // un fond opaque à la BrowserWindow : cela annulait toute transparence.
  window.setBackgroundColor('#00000000');
};

export const backend = createBackend<
  { window: BrowserWindow | null },
  TransparentPlayerConfig
>({
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
    try {
      if (is.windows()) window.setBackgroundMaterial('none');
      if (is.macOS()) window.setVibrancy(null);
    } catch {
      // Les matériaux de la plateforme peuvent être indisponibles.
    }
    window.setBackgroundColor('#000000');
    this.window = null;
  },
});
