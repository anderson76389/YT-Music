import { nativeImage, net } from 'electron';

import { BoundedCache } from './bounded-cache';
import { isTrustedArtworkUrl } from './trusted-artwork-url';

const artworkCache = new BoundedCache<string, Electron.NativeImage>(12, 24 * 1024 * 1024);
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;

export async function loadSongArtwork(src: string, signal: AbortSignal): Promise<Electron.NativeImage | null> {
  if (signal.aborted || !isTrustedArtworkUrl(src)) return null;
  const existing = artworkCache.get(src);
  if (existing) return existing;

  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const stripped = src.split('?')[0];
  const candidates = [...new Set([src, stripped])];
  for (const candidate of candidates) {
    if (deadline.aborted) return null;
    try {
      // No HEAD followed by GET. Native metadata already includes the full URL.
      const response = await net.fetch(candidate, { signal: deadline, redirect: 'error' });
      if (!response.ok || !response.body) continue;
      const declaredSize = Number(response.headers.get('content-length'));
      if (declaredSize > MAX_DOWNLOAD_BYTES) {
        await response.body.cancel();
        continue;
      }
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_DOWNLOAD_BYTES || deadline.aborted) {
            await reader.cancel();
            break;
          }
          parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (deadline.aborted || size > MAX_DOWNLOAD_BYTES || size === 0) continue;
      const image = nativeImage.createFromBuffer(Buffer.concat(parts));
      if (image.isEmpty()) continue;
      const dimensions = image.getSize();
      artworkCache.set(src, image, dimensions.width * dimensions.height * 4);
      return image;
    } catch {
      // An unavailable thumbnail must never break playback or the next track.
    }
  }
  return null;
}
