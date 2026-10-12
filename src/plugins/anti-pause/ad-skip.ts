/** Gestion testable des pubs, sans accès direct au site ou à Electron. */
export type AdVideo = {
  muted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
};

export type AdPlaybackSnapshot = {
  video: AdVideo;
  muted: boolean;
  playbackRate: number;
};

export function restoreAdPlayback(state?: AdPlaybackSnapshot): undefined {
  if (!state) return undefined;
  state.video.muted = state.muted;
  state.video.playbackRate = state.playbackRate;
  return undefined;
}

export function processAdPlayback(
  video: AdVideo,
  isAd: boolean,
  existing?: AdPlaybackSnapshot,
): AdPlaybackSnapshot | undefined {
  if (!isAd) return restoreAdPlayback(existing);

  let state = existing;
  if (!state || state.video !== video) {
    restoreAdPlayback(state);
    state = {
      video,
      muted: video.muted,
      playbackRate: video.playbackRate,
    };
  }

  video.muted = true;
  video.playbackRate = 16;
  if (Number.isFinite(video.duration) && video.duration > 0) {
    try {
      video.currentTime = Math.max(0, video.duration - 0.15);
    } catch {
      // Certains flux ne permettent pas de rechercher la fin de la pub.
    }
  }

  return state;
}
