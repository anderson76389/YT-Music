import { createPlugin } from '@/utils';

export default createPlugin({
  name: () => 'Anti-Pause & Purge Totale',
  description: () => 'Supprime définitivement les 3 points, le menu gris, les pubs et l’inactivité',
  restartNeeded: false,
  config: {
    enabled: true,
  },
  renderer: {
    start() {
      // 1. STYLE GLOBAL AGRESSIF : MASQUAGE FORCÉ DES 3 POINTS ET DU MENU GRIS
      const style = document.createElement('style');
      style.textContent = `
        /* Neutralisation stricte du bouton 3 points */
        ytmusic-settings-button,
        .ytmusic-settings-button,
        tp-yt-paper-icon-button[icon="more_vert"],
        yt-icon-button[icon="more_vert"],
        button[aria-label*="Paramètres"],
        button[aria-label*="Settings"],
        #right-content > ytmusic-settings-button {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          max-width: 0 !important;
          max-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          position: absolute !important;
          left: -9999px !important;
        }

        /* Masquage de l'overlay et des cadres publicitaires */
        .ytp-ad-player-overlay,
        .ytp-ad-player-overlay-layout,
        .ytp-ad-player-overlay-flyout-cta,
        .ytp-ad-module,
        ytmusic-mealbar-promo-renderer,
        yt-mealbar-promo-renderer {
          display: none !important;
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);

      // 2. VERROUILLAGE ÉVÉNEMENTIEL : INTERCEPTION DU CLIC (PHASE CAPTURE)
      // Empêche YouTube de recevoir l'ordre d'ouvrir le menu même si l'élément est cliqué
      window.addEventListener(
        'click',
        (e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;

          const isSettingsTrigger =
            target.closest('ytmusic-settings-button') ||
            target.closest('tp-yt-paper-icon-button[icon="more_vert"]') ||
            target.closest('button[aria-label*="Paramètres"]') ||
            target.closest('button[aria-label*="Settings"]');

          if (isSettingsTrigger) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
        },
        true
      );

      // 3. PURGE DOM CHIRURGICALE CONTINUE (BOUTON + CONTENEUR FLOTTANT DU MENU)
      const eradicateElements = () => {
        // A. Suppression du bouton 3 points (Light DOM et Shadow DOM)
        const selectors = [
          'ytmusic-settings-button',
          'tp-yt-paper-icon-button[icon="more_vert"]',
          'button[aria-label*="Paramètres"]',
          'button[aria-label*="Settings"]',
        ];

        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => el.remove());
        });

        const navBar = document.querySelector('ytmusic-nav-bar');
        if (navBar?.shadowRoot) {
          selectors.forEach((sel) => {
            navBar.shadowRoot?.querySelectorAll(sel).forEach((el) => el.remove());
          });
        }

        // B. Destruction immédiate du menu gris s'il tente d'apparaître
        document.querySelectorAll('ytmusic-menu-popup-renderer, tp-yt-iron-dropdown').forEach((popup) => {
          const content = popup.textContent || '';
          if (
            content.includes('Music Premium') ||
            content.includes('Paramètres') ||
            content.includes('Conditions d') ||
            content.includes('Résilier') ||
            content.includes('Aide')
          ) {
            popup.remove();
          }
        });
      };

      eradicateElements();
      setInterval(eradicateElements, 100);

      // 4. SAUT INSTANTANÉ DES ANNONCES AUDIO/VIDÉO (0 LATENCE)
      const fastSkipAd = (video: HTMLVideoElement) => {
        const player = document.getElementById('movie_player') as (HTMLElement & { skipAd?: () => void }) | null;
        const isAd = player?.classList.contains('ad-showing') || player?.classList.contains('ad-interrupting');

        if (isAd) {
          video.muted = true;
          video.playbackRate = 16.0;

          if (!isNaN(video.duration) && isFinite(video.duration)) {
            video.currentTime = video.duration;
          } else {
            video.currentTime = 99999;
          }

          if (typeof player?.skipAd === 'function') {
            player.skipAd();
          }

          const skipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button',
            '.ytp-ad-skip-button-slot button',
            'button.ytp-ad-overlay-close-button'
          ];
          for (const sel of skipSelectors) {
            const btn = document.querySelector<HTMLElement>(sel);
            if (btn) {
              btn.click();
              break;
            }
          }

          video.dispatchEvent(new Event('ended'));
        } else if (video.muted) {
          video.muted = false;
        }
      };

      const bindVideoEvents = () => {
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video && !video.dataset.hooked) {
          video.dataset.hooked = 'true';
          video.addEventListener('timeupdate', () => fastSkipAd(video));
          video.addEventListener('loadedmetadata', () => fastSkipAd(video));
          video.addEventListener('play', () => fastSkipAd(video));
        }
      };

      bindVideoEvents();
      setInterval(bindVideoEvents, 500);

      // 5. FALSIFICATION D'ACTIVITÉ ET MODALE D'INACTIVITÉ
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
      document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

      setInterval(() => {
        try {
          (window as unknown as { _lact: number })._lact = Date.now();
        } catch {}

        window.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: Math.floor(Math.random() * 10) + 1,
            clientY: Math.floor(Math.random() * 10) + 1,
          })
        );
      }, 15000);

      const observer = new MutationObserver(() => {
        eradicateElements();

        const dialog = document.querySelector('ytmusic-you-there-renderer');
        if (dialog) {
          const btn = dialog.querySelector<HTMLElement>('button, #button, yt-button-renderer');
          if (btn) btn.click();

          const video = document.querySelector<HTMLVideoElement>('video');
          if (video && video.paused) video.play().catch(() => {});
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
    },
  },
});