export type MiniPlayerState = {
  title: string;
  artist: string;
  cover: string;
  playing: boolean;
  volume: number | null;
  muted: boolean;
};

export function normalizeMiniVolume(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}
