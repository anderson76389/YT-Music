import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import style from './style.css?inline';

/**
 * La barre floue est un plugin CSS : le chargeur commun insère et retire
 * les styles à chaque activation/désactivation. Une CSSStyleSheet adoptée
 * puis simplement vidée empêchait la réactivation fiable.
 */
export default createPlugin({
  name: () => t('plugins.blur-nav-bar.name'),
  description: () => t('plugins.blur-nav-bar.description'),
  restartNeeded: false,
  config: { enabled: false },
  stylesheets: [style],
});
