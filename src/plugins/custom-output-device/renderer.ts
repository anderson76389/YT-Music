import { createRenderer } from '@/utils';

import type { CustomOutputPluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

type OutputContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const updateDeviceList = async (
  context: RendererContext<CustomOutputPluginConfig>,
) => {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  let devices: MediaDeviceInfo[];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (error) {
    console.warn('[YT Music] Impossible de lister les sorties audio', error);
    return;
  }
  const newDevices: Record<string, string> = {
    default: 'Périphérique par défaut',
  };
  for (const device of devices) {
    if (device.kind !== 'audiooutput') continue;
    newDevices[device.deviceId] = device.label || device.deviceId;
  }
  const options = await context.getConfig();
  if (JSON.stringify(options.devices ?? {}) === JSON.stringify(newDevices)) {
    return;
  }
  await context.setConfig({ devices: newDevices });
};

const updateSinkId = async (
  audioContext?: OutputContext,
  sinkId?: string,
) => {
  if (!audioContext || !sinkId || !audioContext.setSinkId) return;
  try {
    await audioContext.setSinkId(sinkId);
  } catch (error) {
    console.warn('[YT Music] Périphérique de sortie indisponible', error);
  }
};

export const renderer = createRenderer<
  {
    options?: CustomOutputPluginConfig;
    audioContext?: OutputContext;
    deviceChangeHandler: (() => void) | null;
    audioCanPlayHandler: (event: CustomEvent<Compressor>) => Promise<void>;
  },
  CustomOutputPluginConfig
>({
  deviceChangeHandler: null,

  async audioCanPlayHandler({ detail: { audioContext } }) {
    this.audioContext = audioContext;
    await updateSinkId(audioContext, this.options?.output);
  },

  async onPlayerApiReady(_: MusicPlayer, context) {
    this.options = await context.getConfig();

    // Énumérer les sorties ne nécessite pas de demander l'accès au micro.
    // Conserver le lecteur fonctionnel si l'API du navigateur refuse.
    if (navigator.mediaDevices) {
      this.deviceChangeHandler = () => {
        void updateDeviceList(context);
      };
      navigator.mediaDevices.addEventListener(
        'devicechange',
        this.deviceChangeHandler,
      );
    }

    document.removeEventListener('peard:audio-can-play', this.audioCanPlayHandler);
    document.addEventListener('peard:audio-can-play', this.audioCanPlayHandler);
    await updateDeviceList(context);
  },

  stop() {
    document.removeEventListener('peard:audio-can-play', this.audioCanPlayHandler);
    if (this.deviceChangeHandler) {
      navigator.mediaDevices?.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
    this.audioContext = undefined;
  },

  async onConfigChange(config) {
    this.options = config;
    await updateSinkId(this.audioContext, config.output);
  },
});
