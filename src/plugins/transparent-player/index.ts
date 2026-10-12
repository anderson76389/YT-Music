import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { onMenu } from './menu';
import style from './style.css?inline';
import { MaterialType, type TransparentPlayerConfig } from './types';

const defaultConfig: TransparentPlayerConfig = {
  enabled: false,
  opacity: 0.5,
  type: MaterialType.NONE,
};

type TransparentRendererState = {
  props: TransparentPlayerConfig;
  applyVisuals(): void;
  applyVariables(): void;
};

export default createPlugin<unknown, unknown, TransparentRendererState>({
  name: () => t('plugins.transparent-player.name'),
  description: () => t('plugins.transparent-player.description'),
  addedVersion: '3.11.x',
  restartNeeded: true,
  config: defaultConfig,
  stylesheets: [style],
  menu: onMenu,
  backend,
  renderer: {
    props: {
      enabled: defaultConfig.enabled,
      opacity: defaultConfig.opacity,
      type: defaultConfig.type,
    } as TransparentPlayerConfig,
    async start({ getConfig }) {
      this.props = await getConfig();
      this.applyVisuals();
    },
    onConfigChange(newConfig) {
      this.props = newConfig;
      this.applyVisuals();
    },
    stop() {
      document.body.classList.remove('transparent-background-color');
      document.body.classList.remove('transparent-player-backdrop-filter');
      document.body.classList.remove('transparent-player');
      document.documentElement.style.removeProperty(
        '--ytmd-transparent-player-opacity',
      );
    },
    applyVisuals() {
      document.body.classList.add('transparent-background-color');
      document.body.classList.add('transparent-player-backdrop-filter');
      document.body.classList.add('transparent-player');
      this.applyVariables();
    },
    applyVariables(this: { props: TransparentPlayerConfig }) {
      const { opacity } = this.props;
      document.documentElement.style.setProperty(
        '--ytmd-transparent-player-opacity',
        opacity.toString(),
      );
    },
  },
});
