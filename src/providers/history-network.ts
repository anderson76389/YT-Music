import { NetworkFilter, type ElectronBlocker } from '@ghostery/adblocker-electron';

// Native listening history needs the playback and watchtime requests.
// Do not generate/replay requests or bypass the user's Google history settings.
// Do not allow unrelated trackers or advertising endpoints.
export const HISTORY_NETWORK_EXCEPTIONS = [
  '@@||s.youtube.com/api/stats/playback?*',
  '@@||s.youtube.com/api/stats/watchtime?*',
  '@@||music.youtube.com/api/stats/playback?*',
  '@@||music.youtube.com/api/stats/watchtime?*',
];

export function preserveNativeHistory(blocker: ElectronBlocker): void {
  const filters = HISTORY_NETWORK_EXCEPTIONS
    .map((rule) => NetworkFilter.parse(rule))
    .filter((filter): filter is NetworkFilter => filter !== null);
  blocker.update({ newNetworkFilters: filters });
}
