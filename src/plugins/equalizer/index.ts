import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import {
  defaultPresets,
  presetConfigs,
  type Preset,
  type FilterConfig,
} from './presets';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export type EqualizerPluginConfig = {
  enabled: boolean;
  filters: FilterConfig[];
  presets: { [preset in Preset]: boolean };
};

type AudioBinding = {
  source: MediaElementAudioSourceNode;
  context: AudioContext;
  nodes: BiquadFilterNode[];
  disconnectedDirect: boolean;
};

/** Une seule chaîne de filtres, nettoyée lors d'un changement de piste ou preset. */
export function disconnectEqualizer(binding: AudioBinding | null): void {
  if (!binding) return;
  for (const node of binding.nodes) {
    try { binding.source.disconnect(node); } catch {}
    try { node.disconnect(); } catch {}
  }
  if (binding.disconnectedDirect) {
    try { binding.source.connect(binding.context.destination); } catch {}
  }
}

function createEqualizerBinding(
  source: MediaElementAudioSourceNode,
  context: AudioContext,
  config: EqualizerPluginConfig,
): AudioBinding {
  const specs = [
    ...(config.filters ?? []),
    ...defaultPresets
      .filter((preset) => config.presets?.[preset])
      .map((preset) => presetConfigs[preset]),
  ];
  const nodes = specs.map((filter) => {
    const node = context.createBiquadFilter();
    node.type = filter.type;
    node.frequency.value = filter.frequency;
    node.Q.value = filter.Q;
    node.gain.value = filter.gain;
    return node;
  });

  if (!nodes.length) return { source, context, nodes, disconnectedDirect: false };

  let disconnectedDirect = false;
  try {
    source.disconnect(context.destination);
    disconnectedDirect = true;
  } catch {
    // Un autre plugin contrôle parfois déjà le routage de cette sortie.
  }

  try {
    source.connect(nodes[0]);
    for (let i = 1; i < nodes.length; i++) {
      nodes[i - 1].connect(nodes[i]);
    }
    nodes[nodes.length - 1].connect(context.destination);
  } catch (error) {
    disconnectEqualizer({ source, context, nodes, disconnectedDirect });
    console.warn('[YT Music] Égaliseur : routage audio indisponible', error);
    return { source, context, nodes: [], disconnectedDirect: false };
  }

  return { source, context, nodes, disconnectedDirect };
}

export default createPlugin({
  name: () => t('plugins.equalizer.name'),
  description: () => t('plugins.equalizer.description'),
  restartNeeded: false,
  addedVersion: '3.7.X',
  config: {
    enabled: false,
    filters: [],
    presets: { 'bass-booster': false },
  } as EqualizerPluginConfig,
  menu: async ({
    getConfig,
    setConfig,
  }: MenuContext<EqualizerPluginConfig>): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.equalizer.menu.presets.label'),
        type: 'submenu',
        submenu: defaultPresets.map((preset) => ({
          label: t(`plugins.equalizer.menu.presets.list.${preset}`),
          type: 'radio',
          checked: config.presets[preset],
          click() {
            setConfig({
              presets: { ...config.presets, [preset]: !config.presets[preset] },
            });
          },
        })),
      },
    ];
  },
  renderer: {
    settings: null as EqualizerPluginConfig | null,
    binding: null as AudioBinding | null,
    onAudioReady: null as EventListener | null,
    async start({ getConfig }) {
      this.settings = await getConfig();
      if (this.onAudioReady) document.removeEventListener('peard:audio-can-play', this.onAudioReady);
      this.onAudioReady = ((event: Event) => {
        const detail = (event as CustomEvent<{
          audioSource: MediaElementAudioSourceNode;
          audioContext: AudioContext;
        }>).detail;
        if (!detail?.audioSource || !detail.audioContext) return;
        disconnectEqualizer(this.binding);
        this.binding = createEqualizerBinding(
          detail.audioSource,
          detail.audioContext,
          this.settings!,
        );
      }) as EventListener;
      document.addEventListener('peard:audio-can-play', this.onAudioReady);
    },
    onConfigChange(config: EqualizerPluginConfig) {
      this.settings = config;
      const old = this.binding;
      disconnectEqualizer(old);
      this.binding = old
        ? createEqualizerBinding(old.source, old.context, config)
        : null;
    },
    stop() {
      if (this.onAudioReady) document.removeEventListener('peard:audio-can-play', this.onAudioReady);
      this.onAudioReady = null;
      disconnectEqualizer(this.binding);
      this.binding = null;
      this.settings = null;
    },
  },
});
