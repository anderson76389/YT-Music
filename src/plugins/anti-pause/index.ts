import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, type BrowserWindow } from 'electron';

import { createPlugin } from '@/utils';

import { processAdPlayback, restoreAdPlayback, type AdPlaybackSnapshot } from './ad-skip';
import { dismissIdlePrompt, startIdleHeartbeat } from './runtime';

type VideoBinding = {
  video: HTMLVideoElement;
  handler: () => void;
};

type DocumentProperty = 'hidden' | 'visibilityState' | 'webkitVisibilityState';

type AntiPauseBackendState = {
  blocker?: ElectronBlocker;
  blockerWindow?: BrowserWindow;
  running: boolean;
  generation: number;
};

type AntiPauseRendererState = {
  style?: HTMLStyleElement;
  observer?: MutationObserver;
  playerObserver?: MutationObserver;
  player?: HTMLElement;
  videoBinding?: VideoBinding;
  adState?: AdPlaybackSnapshot;
  stopHeartbeat?: () => void;
  dialogTimer?: number;
  visibilityDescriptors?: Partial<
    Record<DocumentProperty, PropertyDescriptor | null>
  >;
  onVisibilityChange?: (e: Event) => void;
  skipAdIfPresent(): void;
  restoreAdState(): void;
};


// Masquer seulement les éléments publicitaires, jamais les paramètres ou
// menus ordinaires de YouTube Music (nécessaires aux autres plugins).
const styles = `
  .ytp-ad-player-overlay,
  .ytp-ad-player-overlay-layout,
  .ytp-ad-player-overlay-flyout-cta,
  .ytp-ad-module,
  ytmusic-mealbar-promo-renderer,
  yt-mealbar-promo-renderer,
  .ytp-ad-image-overlay,
  .ytp-ad-text-overlay {
    display: none !important;
    visibility: hidden !important;
  }
  #movie_player.ad-showing video,
  #movie_player.ad-interrupting video {
    visibility: hidden !important;
  }
`;

export default createPlugin<
  AntiPauseBackendState,
  unknown,
  AntiPauseRendererState
>({
  name: () => 'Anti-Pause & Purge Totale',
  description: () =>
    'Passage des publicités, blocage réseau best-effort et lecture continue',
  restartNeeded: false,
  config: { enabled: true },

  backend: {
    blocker: undefined as ElectronBlocker | undefined,
    blockerWindow: undefined as BrowserWindow | undefined,
    running: false,
    generation: 0,

    async start({ window }) {
      this.running = true;
      const generation = ++this.generation;
      this.blockerWindow = window;

      // Les filtres sont mis en cache localement, pas téléchargés à chaque
      // démarrage. Un réseau indisponible ne doit pas empêcher l'application.
      try {
        // Délai borné pour ne pas bloquer le lancement en cas de réseau HS.
        const timedFetch: typeof fetch = (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8_000) });

        const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(
          timedFetch,
          {
            path: join(app.getPath('userData'), 'anti-pause-ads.bin'),
            read: readFile,
            write: writeFile,
          },
        );

        if (!this.running || generation !== this.generation) return;
        blocker.enableBlockingInSession(window.webContents.session);
        this.blocker = blocker;
      } catch (error) {
        console.warn(
          '[Anti-Pause] Listes réseau indisponibles : saut DOM de secours actif.',
          error,
        );
      }
    },

    stop() {
      this.running = false;
      this.generation++;
      if (this.blocker && this.blockerWindow) {
        this.blocker.disableBlockingInSession(
          this.blockerWindow.webContents.session,
        );
      }
      this.blocker = undefined;
      this.blockerWindow = undefined;
    },
  },

  renderer: {
    style: undefined as HTMLStyleElement | undefined,
    observer: undefined as MutationObserver | undefined,
    playerObserver: undefined as MutationObserver | undefined,
    player: undefined as HTMLElement | undefined,
    videoBinding: undefined as VideoBinding | undefined,
    adState: undefined as AdPlaybackSnapshot | undefined,
    stopHeartbeat: undefined as (() => void) | undefined,
    dialogTimer: undefined as number | undefined,
    visibilityDescriptors: undefined as
      | Partial<Record<DocumentProperty, PropertyDescriptor | null>>
      | undefined,
    onVisibilityChange: undefined as ((e: Event) => void) | undefined,

    start() {
      this.style = document.createElement('style');
      this.style.textContent = styles;
      (document.head ?? document.documentElement).appendChild(this.style);

      // L'horodatage est rafraîchi sans modifier les interactions de lecture.
      this.stopHeartbeat = startIdleHeartbeat(window, {
        now: () => Date.now(),
        setInterval: (callback, interval) => window.setInterval(callback, interval),
        clearInterval: (id) => window.clearInterval(id),
      });

      // Compatibilité avec l'ancien dispositif anti-inactivité.
      const saved: Partial<Record<DocumentProperty, PropertyDescriptor | null>> = {};
      const values: Record<DocumentProperty, boolean | string> = {
        hidden: false,
        visibilityState: 'visible',
        webkitVisibilityState: 'visible',
      };
      for (const property of Object.keys(values) as DocumentProperty[]) {
        saved[property] =
          Object.getOwnPropertyDescriptor(document, property) ?? null;
        try {
          Object.defineProperty(document, property, {
            configurable: true,
            get: () => values[property],
          });
        } catch {
          // Certains moteurs n'autorisent pas la redéfinition.
        }
      }
      this.visibilityDescriptors = saved;

      this.onVisibilityChange = (event: Event) => {
        event.stopImmediatePropagation();
        window._lact = Date.now();
      };
      document.addEventListener('visibilitychange', this.onVisibilityChange, true);

      // Le contrôle de classe réagit à l'apparition de l'annonce sans attendre
      // l'événement timeupdate (qui arrive après la première image).
      const bindVideo = () => {
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video !== this.videoBinding?.video) {
          if (this.videoBinding) {
            this.videoBinding.video.removeEventListener(
              'timeupdate',
              this.videoBinding.handler,
            );
            this.videoBinding.video.removeEventListener(
              'loadedmetadata',
              this.videoBinding.handler,
            );
            this.videoBinding.video.removeEventListener(
              'play',
              this.videoBinding.handler,
            );
          }
          if (video) {
            const handler = () => this.skipAdIfPresent();
            video.addEventListener('timeupdate', handler);
            video.addEventListener('loadedmetadata', handler);
            video.addEventListener('play', handler);
            this.videoBinding = { video, handler };
          } else {
            this.videoBinding = undefined;
          }
        }

        const player = document.getElementById('movie_player');
        if (player !== this.player) {
          this.playerObserver?.disconnect();
          this.player = player ?? undefined;
          if (player) {
            this.playerObserver = new MutationObserver(() =>
              this.skipAdIfPresent(),
            );
            this.playerObserver.observe(player, {
              attributes: true,
              attributeFilter: ['class'],
            });
          }
        }
      };

      const refresh = () => {
        bindVideo();
        dismissIdlePrompt(document);
        this.skipAdIfPresent();
      };

      this.observer = new MutationObserver(refresh);
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      refresh();
      // Vérification de secours pour les modales déjà présentes dont seule
      // la visibilité change ; le contrôle continue même sans Mutation DOM.
      this.dialogTimer = window.setInterval(() => {
        bindVideo();
        dismissIdlePrompt(document);
        this.skipAdIfPresent();
      }, 1_000);
    },

    skipAdIfPresent() {
      const video = this.videoBinding?.video;
      const player = this.player;
      if (!video || !player) return;

      const isAd =
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting');

      this.adState = processAdPlayback(video, isAd, this.adState);
      if (!isAd) return;

      const skippable = player as HTMLElement & { skipAd?: () => void };
      if (typeof skippable.skipAd === 'function') {
        try {
          skippable.skipAd();
        } catch {
          // API modifiée côté YouTube.
        }
      }

      document
        .querySelector<HTMLElement>(
          '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button',
        )
        ?.click();
    },

    restoreAdState() {
      this.adState = restoreAdPlayback(this.adState);
    },

    stop() {
      this.observer?.disconnect();
      this.observer = undefined;
      this.playerObserver?.disconnect();
      this.playerObserver = undefined;
      this.player = undefined;
      if (this.dialogTimer !== undefined) {
        window.clearInterval(this.dialogTimer);
        this.dialogTimer = undefined;
      }
      this.stopHeartbeat?.();
      this.stopHeartbeat = undefined;

      if (this.videoBinding) {
        const { video, handler } = this.videoBinding;
        video.removeEventListener('timeupdate', handler);
        video.removeEventListener('loadedmetadata', handler);
        video.removeEventListener('play', handler);
      }
      this.videoBinding = undefined;
      this.restoreAdState();

      if (this.onVisibilityChange) {
        document.removeEventListener(
          'visibilitychange',
          this.onVisibilityChange,
          true,
        );
        this.onVisibilityChange = undefined;
      }

      const properties = this.visibilityDescriptors;
      if (properties) {
        for (const property of Object.keys(properties) as DocumentProperty[]) {
          const descriptor = properties[property];
          try {
            if (descriptor) {
              Object.defineProperty(document, property, descriptor);
            } else {
              Reflect.deleteProperty(document, property);
            }
          } catch {
            // Propriété du DOM verrouillée par le moteur.
          }
        }
      }
      this.visibilityDescriptors = undefined;
      this.style?.remove();
      this.style = undefined;
    },
  },
});
