import { createRenderer } from '@/utils';

import { disposeReactiveRoot } from './reactive-root';
import { setConfig, setCurrentTime } from './renderer';
import { fetchLyrics } from './store';
import { selectors, tabStates } from './utils';

import type { SyncedLyricsPluginConfig } from '../types';
import type { SongInfo } from '@/providers/song-info';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export let _ytAPI: MusicPlayer | null = null;
export let netFetch: (
  url: string,
  init?: RequestInit,
) => Promise<[number, string, Record<string, string>]>;

export const renderer = createRenderer<
  {
    observerCallback: MutationCallback;
    observer?: MutationObserver;
    videoDataChange: () => Promise<void>;
    updateTimestampInterval?: ReturnType<typeof setInterval>;
    retryTimeout?: ReturnType<typeof setTimeout>;
    retryCount: number;
    active: boolean;
    songInfoListenerInstalled: boolean;
    api?: MusicPlayer;
  },
  SyncedLyricsPluginConfig
>({
  active: false,
  retryCount: 0,
  songInfoListenerInstalled: false,

  onConfigChange(newConfig) {
    setConfig(newConfig);
  },

  observerCallback(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      const header = mutation.target as HTMLElement;

      switch (mutation.attributeName) {
        case 'disabled':
          header.removeAttribute('disabled');
          break;
        case 'aria-selected':
          tabStates[header.ariaSelected ?? 'false']();
          break;
      }
    }
  },

  async onPlayerApiReady(api: MusicPlayer) {
    if (this.api) this.api.removeEventListener('videodatachange', this.videoDataChange);
    this.api = api;
    _ytAPI = api;
    if (!this.active) return;
    api.addEventListener('videodatachange', this.videoDataChange);
    await this.videoDataChange();
  },
  async videoDataChange() {
    if (!this.active) return;
    if (!this.updateTimestampInterval) {
      this.updateTimestampInterval = setInterval(
        () => setCurrentTime((_ytAPI?.getCurrentTime() ?? 0) * 1000),
        100,
      );
    }

    // prettier-ignore
    this.observer ??= new MutationObserver(this.observerCallback);
    this.observer.disconnect();

    // The lyrics tab may be mounted late by YouTube Music.
    // Avoid an unbounded waiter when the plugin is disabled.
    const header = document.querySelector<HTMLElement>(selectors.head);
    if (!header) {
      if (this.retryCount < 20 && !this.retryTimeout) {
        this.retryCount++;
        this.retryTimeout = setTimeout(() => {
          this.retryTimeout = undefined;
          if (this.active) void this.videoDataChange();
        }, 500);
      }
      return;
    }
    this.retryCount = 0;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = undefined;
    header.removeAttribute('disabled');
    tabStates[header.ariaSelected ?? 'false']();
    this.observer.observe(header, { attributes: true });
  },

  async start(ctx: RendererContext<SyncedLyricsPluginConfig>) {
    this.active = true;
    this.retryCount = 0;
    netFetch = ctx.ipc.invoke.bind(ctx.ipc, 'synced-lyrics:fetch');
    setConfig(await ctx.getConfig());
    if (!this.songInfoListenerInstalled) {
      this.songInfoListenerInstalled = true;
      ctx.ipc.on('peard:update-song-info', (info: SongInfo) => {
        if (this.active) fetchLyrics(info);
      });
    }
  },

  stop() {
    this.active = false;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = undefined;
    this.retryCount = 0;
    if (this.updateTimestampInterval) clearInterval(this.updateTimestampInterval);
    this.updateTimestampInterval = undefined;
    this.observer?.disconnect();
    this.api?.removeEventListener('videodatachange', this.videoDataChange);
    this.api = undefined;
    _ytAPI = null;
    disposeReactiveRoot();
  },
});
