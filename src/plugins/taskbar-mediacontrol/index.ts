import { t } from '@/i18n';
import { setWindowsThumbnailThemeAware } from '@/providers/windows-thumbnail-controls';
import { Platform } from '@/types/plugins';
import { createPlugin } from '@/utils';

/**
 * La barre de miniature Windows est déjà installée par le processus principal.
 * Ce plugin permet sa synchronisation avec le thème clair/sombre de Windows.
 * Il ne doit jamais appeler setThumbarButtons lui-même : deux gestionnaires
 * concurrents empêchent le logo Lecture/Pause de se mettre à jour correctement.
 */
export default createPlugin({
  name: () => t('plugins.taskbar-mediacontrol.name'),
  description: () => t('plugins.taskbar-mediacontrol.description'),
  restartNeeded: true,
  platform: Platform.Windows,
  config: {
    enabled: false,
  },
  backend: {
    start({ window }) {
      setWindowsThumbnailThemeAware(window, true);
    },
    stop({ window }) {
      setWindowsThumbnailThemeAware(window, false);
    },
  },
});
