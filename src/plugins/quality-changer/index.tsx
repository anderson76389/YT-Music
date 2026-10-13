import { dialog } from 'electron';
import { render } from 'solid-js/web';

import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { QualitySettingButton } from './templates/quality-setting-button';

import type { MusicPlayer } from '@/types/music-player';

export default createPlugin({
  name: () => t('plugins.quality-changer.name'),
  description: () => t('plugins.quality-changer.description'),
  restartNeeded: false,
  config: {
    enabled: false,
  },

  backend: {
    start({ ipc, window }) {
      ipc.handle(
      'peard:quality-changer',
      async (qualityLabels: string[], currentIndex: number) =>
        await dialog.showMessageBox(window, {
          type: 'question',
          buttons: qualityLabels,
          defaultId: currentIndex,
          title: t(
            'plugins.quality-changer.backend.dialog.quality-changer.title',
          ),
          message: t(
            'plugins.quality-changer.backend.dialog.quality-changer.message',
          ),
          detail: t(
            'plugins.quality-changer.backend.dialog.quality-changer.detail',
            {
              quality: qualityLabels[currentIndex],
            },
          ),
          cancelId: -1,
        }),
    );
    },
    stop({ ipc }) {
      ipc.removeHandler('peard:quality-changer');
    },
  },

  renderer: {
    qualitySettingsButtonContainer: document.createElement('div'),
    disposeRender: null as (() => void) | null,
    onPlayerApiReady(api: MusicPlayer, context) {
      const chooseQuality = async (e: MouseEvent) => {
        e.stopPropagation();

        const qualityLevels = api.getAvailableQualityLevels();
        if (!qualityLevels?.length) return;

        const currentIndex = qualityLevels.indexOf(api.getPlaybackQuality());

        const quality = (await context.ipc.invoke(
          'peard:quality-changer',
          api.getAvailableQualityLabels(),
          currentIndex,
        )) as {
          response: number;
        };

        if (!quality || quality.response < 0 || quality.response >= qualityLevels.length) {
          return;
        }

        const newQuality = qualityLevels[quality.response];
        api.setPlaybackQualityRange(newQuality);
        api.setPlaybackQuality(newQuality);
      };

      this.disposeRender?.();
      this.disposeRender = render(
        () => (
          <QualitySettingButton
            label={t(
              'plugins.quality-changer.renderer.quality-settings-button.label',
            )}
            onClick={chooseQuality}
          />
        ),
        this.qualitySettingsButtonContainer,
      );

      const setup = () => {
        document
          .querySelector('.top-row-buttons.ytmusic-player')
          ?.prepend(this.qualitySettingsButtonContainer);
      };

      setup();
    },
    stop() {
      this.disposeRender?.();
      this.disposeRender = null;
      this.qualitySettingsButtonContainer.remove();
      this.qualitySettingsButtonContainer = document.createElement('div');
    },
  },
});
