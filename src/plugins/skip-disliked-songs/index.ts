import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { isDislikedButton } from './logic';

/**
 * Le bouton J'aime et le lecteur sont reconstruits lors des navigations
 * internes. Un observateur fixé sur le tout premier bouton cesse alors de
 * fonctionner : on surveille le lecteur courant et on rattache l'observateur.
 */
type SkipDislikedRenderer = {
  active: boolean;
  observed: HTMLElement | null;
  observer: MutationObserver | null;
  interval: ReturnType<typeof setInterval> | null;
  lastSkippedVideo: string;
  findButton(): HTMLElement | null;
  check(): void;
  attach(): void;
};
export default createPlugin<unknown, unknown, SkipDislikedRenderer>({
  name: () => t('plugins.skip-disliked-songs.name'),
  description: () => t('plugins.skip-disliked-songs.description'),
  restartNeeded: false,
  config: { enabled: false },
  renderer: {
    active: false,
    observed: null as HTMLElement | null,
    observer: null as MutationObserver | null,
    interval: null as ReturnType<typeof setInterval> | null,
    lastSkippedVideo: '',
    findButton() {
      return document.querySelector<HTMLElement>(
        '#like-button-renderer, ytmusic-like-button-renderer',
      );
    },
    check() {
      if (!this.active) return;
      const button = this.findButton();
      const id = new URLSearchParams(location.search).get('v') ?? '';
      if (!button || !isDislikedButton(button)) return;
      if (id && this.lastSkippedVideo === id) return;

      const next = document.querySelector<HTMLElement>(
        'ytmusic-player-bar .next-button, yt-icon-button.next-button',
      );
      if (!next) return;
      if (id) this.lastSkippedVideo = id;
      next.click();
    },
    attach() {
      if (!this.active) return;
      const button = this.findButton();
      if (button !== this.observed) {
        this.observer?.disconnect();
        this.observed = button;
        if (button) {
          this.observer = new MutationObserver(() => this.check());
          this.observer.observe(button, {
            attributes: true,
            attributeFilter: ['like-status', 'aria-pressed'],
          });
        }
      }
      this.check();
    },
    start() {
      this.active = true;
      this.lastSkippedVideo = '';
      this.attach();
      this.interval = setInterval(() => this.attach(), 1200);
    },
    stop() {
      this.active = false;
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.observer?.disconnect();
      this.observer = null;
      this.observed = null;
    },
  },
});
