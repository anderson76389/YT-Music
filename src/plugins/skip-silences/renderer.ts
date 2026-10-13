import type { SkipSilencesPluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';

let settings: SkipSilencesPluginConfig;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let media: HTMLVideoElement | null = null;
let playOrSeekHandler: (() => void) | null = null;
let hasAudioStarted = false;
let silenceSamples = 0;

const SILENCE_DB = -75;
const CHECK_EVERY_MS = 45;

function clearMonitor() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (media && playOrSeekHandler) {
    media.removeEventListener('play', playOrSeekHandler);
    media.removeEventListener('seeked', playOrSeekHandler);
  }
  if (source && analyser) {
    try { source.disconnect(analyser); } catch {}
  }
  analyser?.disconnect();
  analyser = null;
  source = null;
  media = null;
  playOrSeekHandler = null;
  hasAudioStarted = false;
  silenceSamples = 0;
}

function maxVolume(node: AnalyserNode, frequencies: Float32Array<ArrayBuffer>) {
  node.getFloatFrequencyData(frequencies);
  let loudest = Number.NEGATIVE_INFINITY;
  for (let i = 4; i < frequencies.length; i++) {
    if (frequencies[i] > loudest) loudest = frequencies[i];
  }
  return loudest;
}

function audioCanPlayListener(event: CustomEvent<Compressor>) {
  if (!running || !event.detail?.audioContext || !event.detail.audioSource) return;
  clearMonitor();

  const { audioContext, audioSource } = event.detail;
  const selectedVideo = document.querySelector<HTMLVideoElement>('video');
  if (!selectedVideo) return;
  const video: HTMLVideoElement = selectedVideo;

  const node = audioContext.createAnalyser();
  node.fftSize = 512;
  node.smoothingTimeConstant = 0.1;
  try {
    audioSource.connect(node);
  } catch (error) {
    console.warn('[YT Music] Passer les silences : analyseur inaccessible', error);
    return;
  }

  analyser = node;
  source = audioSource;
  media = video;
  playOrSeekHandler = () => {
    hasAudioStarted = false;
    silenceSamples = 0;
  };
  video.addEventListener('play', playOrSeekHandler);
  video.addEventListener('seeked', playOrSeekHandler);
  const frequencies = new Float32Array(node.frequencyBinCount);

  function sample() {
    if (!running || analyser !== node || media !== video) return;
    if (!video.paused && !video.seeking && !video.ended &&
        !video.muted && video.volume > 0) {
      const loudness = maxVolume(node, frequencies);
      if (loudness > SILENCE_DB) {
        hasAudioStarted = true;
        silenceSamples = 0;
      } else {
        silenceSamples++;
        if (silenceSamples >= 3 &&
            (!settings.onlySkipBeginning || !hasAudioStarted)) {
          const end = Number.isFinite(video.duration)
            ? Math.max(0, video.duration - 0.2)
            : video.currentTime + 0.15;
          video.currentTime = Math.min(video.currentTime + 0.15, end);
        }
      }
    } else {
      silenceSamples = 0;
    }
    timer = setTimeout(sample, CHECK_EVERY_MS);
  }
  sample();
}

export const onRendererLoad = async ({
  getConfig,
}: RendererContext<SkipSilencesPluginConfig>) => {
  settings = await getConfig();
  running = true;
  document.removeEventListener('peard:audio-can-play', audioCanPlayListener);
  document.addEventListener('peard:audio-can-play', audioCanPlayListener, {
    passive: true,
  });
};

export const onConfigChange = (newConfig: SkipSilencesPluginConfig) => {
  settings = newConfig;
};

export const onRendererUnload = () => {
  running = false;
  document.removeEventListener('peard:audio-can-play', audioCanPlayListener);
  clearMonitor();
};
