import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { menu } from './menu';
import style from './style.css?inline';
import { type AmbientModePluginConfig } from './types';

const defaultConfig: AmbientModePluginConfig = {
  enabled: false,
  quality: 50,
  buffer: 30,
  interpolationTime: 1500,
  blur: 100,
  size: 100,
  opacity: 1,
  fullscreen: false,
};

type AmbientRendererState = {
  settings: AmbientModePluginConfig;
  host: HTMLElement | null;
  backdrop: HTMLDivElement | null;
  art: HTMLImageElement | null;
  canvas: HTMLCanvasElement | null;
  source: string;
  responseArt: string;
  ticker: ReturnType<typeof setInterval> | null;
  videoTicker: ReturnType<typeof setInterval> | null;
  dataListener: EventListener | null;
  refresh(): void;
  applySettings(): void;
  drawVideoFrame(): void;
  startVideoTicker(): void;
};

export default createPlugin<unknown, unknown, AmbientRendererState>({
  name: () => t('plugins.ambient-mode.name'),
  description: () => t('plugins.ambient-mode.description'),
  restartNeeded: false,
  config: defaultConfig,
  stylesheets: [style],
  menu,

  renderer: {
    settings: defaultConfig,
    host: null as HTMLElement | null,
    backdrop: null as HTMLDivElement | null,
    art: null as HTMLImageElement | null,
    canvas: null as HTMLCanvasElement | null,
    source: '',
    responseArt: '',
    ticker: null as ReturnType<typeof setInterval> | null,
    videoTicker: null as ReturnType<typeof setInterval> | null,
    dataListener: null as EventListener | null,

    start({ getConfig }) {
      // Ne jamais attendre un élément vidéo spécifique : sur le nouveau
      // lecteur YT Music, #song-video peut ne pas exister du tout.
      void Promise.resolve(getConfig()).then((config) => {
        this.settings = config;
        this.refresh();
        this.startVideoTicker();
      });
      this.ticker = setInterval(() => this.refresh(), 900);
      this.refresh();
    },

    onPlayerApiReady(playerApi) {
      const updateArtwork = () => {
        const images = playerApi
          .getPlayerResponse()
          ?.videoDetails?.thumbnail?.thumbnails;
        const art = images?.at(-1)?.url ?? '';
        if (art && art !== this.responseArt) {
          this.responseArt = art;
          this.refresh();
        }
      };
      updateArtwork();
      this.dataListener = updateArtwork;
      document.addEventListener('videodatachange', updateArtwork);
    },

    refresh() {
      const host = document.querySelector<HTMLElement>('#player-page');
      if (!host) return;

      if (host !== this.host) {
        this.backdrop?.remove();
        this.host?.classList.remove('ytmd-ambient-host');

        const overlay = document.createElement('div');
        overlay.className = 'ytmd-ambient-backdrop';
        const image = document.createElement('img');
        image.className = 'ytmd-ambient-art';
        image.alt = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'ytmd-ambient-video';
        canvas.setAttribute('aria-hidden', 'true');
        overlay.append(image, canvas);
        host.prepend(overlay);
        host.classList.add('ytmd-ambient-host');

        this.host = host;
        this.backdrop = overlay;
        this.art = image;
        this.canvas = canvas;
        this.source = '';
      }

      this.applySettings();

      const mediaArt = navigator.mediaSession?.metadata?.artwork?.at(-1)?.src;
      const domImage = document.querySelector<HTMLImageElement>(
        '#song-image img, ytmusic-player-bar img, ytmusic-player img, #player img',
      );
      const src = this.responseArt || mediaArt || domImage?.currentSrc || domImage?.src || '';
      if (src && src !== this.source && /^(https?:|blob:|data:image\/)/.test(src)) {
        this.source = src;
        if (this.art) this.art.src = src;
      }
    },

    applySettings() {
      if (!this.backdrop) return;
      const options = this.settings;
      this.backdrop.style.setProperty('--ytmd-ambient-blur', `${options.blur}px`);
      this.backdrop.style.setProperty('--ytmd-ambient-size', `${options.size}%`);
      this.backdrop.style.setProperty('--ytmd-ambient-opacity', String(options.opacity));
      this.backdrop.style.setProperty(
        '--ytmd-ambient-transition',
        `${options.interpolationTime}ms`,
      );
      this.backdrop.classList.toggle('ytmd-ambient-fullscreen', options.fullscreen);
    },

    drawVideoFrame() {
      const canvas = this.canvas;
      if (!canvas || !this.backdrop) return;

      const video = document.querySelector<HTMLVideoElement>(
        '#movie_player video, video.html5-main-video, .html5-video-container video',
      );
      const songVideo = document.querySelector<HTMLElement>('#song-video');
      const videoShown = !songVideo || getComputedStyle(songVideo).display !== 'none';

      if (
        !video ||
        !videoShown ||
        video.paused ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        canvas.classList.remove('ytmd-ambient-has-frame');
        return;
      }

      const quality = Math.max(16, Math.min(256, this.settings.quality));
      const height = Math.max(1, Math.round(
        quality * video.videoHeight / video.videoWidth,
      ));
      if (canvas.width !== quality) canvas.width = quality;
      if (canvas.height !== height) canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, quality, height);
        canvas.classList.add('ytmd-ambient-has-frame');
      } catch {
        // DRM ou frame non exploitable : conserver le fond de pochette.
        canvas.classList.remove('ytmd-ambient-has-frame');
      }
    },

    startVideoTicker() {
      if (this.videoTicker) clearInterval(this.videoTicker);
      const fps = Math.max(1, Math.min(30, this.settings.buffer));
      this.videoTicker = setInterval(() => this.drawVideoFrame(), 1000 / fps);
    },

    onConfigChange(newConfig) {
      this.settings = newConfig;
      this.applySettings();
      this.startVideoTicker();
      this.refresh();
    },

    stop() {
      if (this.ticker) clearInterval(this.ticker);
      if (this.videoTicker) clearInterval(this.videoTicker);
      this.ticker = null;
      this.videoTicker = null;
      if (this.dataListener) {
        document.removeEventListener('videodatachange', this.dataListener);
        this.dataListener = null;
      }
      this.backdrop?.remove();
      this.host?.classList.remove('ytmd-ambient-host');
      this.host = null;
      this.backdrop = null;
      this.art = null;
      this.canvas = null;
      this.source = '';
      this.responseArt = '';
    },
  },
});
