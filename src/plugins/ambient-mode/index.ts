import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { menu } from './menu';
import style from './style.css?inline';
import { type AmbientModePluginConfig } from './types';
import { canDrawAmbientVideo } from './video-state';

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
  active: boolean;
  host: HTMLElement | null;
  backdrop: HTMLDivElement | null;
  art: HTMLImageElement | null;
  canvas: HTMLCanvasElement | null;
  source: string;
  responseArt: string;
  ticker: ReturnType<typeof setInterval> | null;
  videoTicker: ReturnType<typeof setInterval> | null;
  videoTickerFps: number;
  dataListener: EventListener | null;
  refresh(): void;
  applySettings(): void;
  drawVideoFrame(): void;
  startVideoTicker(): void;
};

export default createPlugin<unknown, unknown, AmbientRendererState, AmbientModePluginConfig>({
  name: () => t('plugins.ambient-mode.name'),
  description: () => t('plugins.ambient-mode.description'),
  restartNeeded: false,
  config: defaultConfig,
  stylesheets: [style],
  menu,

  renderer: {
    settings: defaultConfig,
    active: false,
    host: null as HTMLElement | null,
    backdrop: null as HTMLDivElement | null,
    art: null as HTMLImageElement | null,
    canvas: null as HTMLCanvasElement | null,
    source: '',
    responseArt: '',
    ticker: null as ReturnType<typeof setInterval> | null,
    videoTicker: null as ReturnType<typeof setInterval> | null,
    videoTickerFps: 0,
    dataListener: null as EventListener | null,

    start({ getConfig }) {
      this.active = true;

      // On démarre immédiatement le fond, sans attendre une balise vidéo.
      // Les réglages enregistrés sont appliqués dès leur récupération.
      this.refresh();
      this.ticker = setInterval(() => this.refresh(), 900);
      void Promise.resolve(getConfig()).then((config) => {
        if (!this.active) return;
        this.settings = config;
        this.refresh();
      }).catch((error: unknown) => {
        console.warn('[YT Music] Mode ambiant : configuration inaccessible', error);
      });
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
      if (!this.active) return;
      // Selon la génération du lecteur, l'hôte peut être la page, ou le
      // composant custom element. Un échec du premier sélecteur ne doit pas
      // rendre le plugin silencieusement inopérant.
      const host = document.querySelector<HTMLElement>(
        'ytmusic-player-page, #player-page, ytmusic-player-bar',
      );
      if (!host) {
        if (this.videoTicker) clearInterval(this.videoTicker);
        this.videoTicker = null;
        this.videoTickerFps = 0;
        return;
      }

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
      this.startVideoTicker();
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
        !canDrawAmbientVideo(video, videoShown)
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
      // En lecture audio seule ou lorsque la vidéo est masquée, le fond de
      // pochette reste actif mais aucun canvas n'est recalculé à 30 FPS.
      const video = document.querySelector<HTMLVideoElement>(
        '#movie_player video, video.html5-main-video, .html5-video-container video',
      );
      const songVideo = document.querySelector<HTMLElement>('#song-video');
      const videoShown = !songVideo || getComputedStyle(songVideo).display !== 'none';
      const running = this.active && this.backdrop && canDrawAmbientVideo(video, videoShown);

      if (!running) {
        if (this.videoTicker) clearInterval(this.videoTicker);
        this.videoTicker = null;
        this.videoTickerFps = 0;
        this.canvas?.classList.remove('ytmd-ambient-has-frame');
        return;
      }

      const fps = Math.max(1, Math.min(30, this.settings.buffer));
      if (this.videoTicker && this.videoTickerFps === fps) return;
      if (this.videoTicker) clearInterval(this.videoTicker);
      this.videoTickerFps = fps;
      this.drawVideoFrame();
      this.videoTicker = setInterval(() => this.drawVideoFrame(), 1000 / fps);
    },

    onConfigChange(newConfig) {
      this.settings = newConfig;
      this.applySettings();
      this.refresh();
    },

    stop() {
      this.active = false;
      if (this.ticker) clearInterval(this.ticker);
      if (this.videoTicker) clearInterval(this.videoTicker);
      this.ticker = null;
      this.videoTicker = null;
      this.videoTickerFps = 0;
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
