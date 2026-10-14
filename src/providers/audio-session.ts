/** Unique WebAudio session created by the YouTube Music renderer.
 * Exposes it to audio plugins activated after playback has already started.
 * It is local to one renderer document and is recreated on full reload.
 */
export type AudioSession = {
  audioContext: AudioContext;
  audioSource: MediaElementAudioSourceNode;
};

let current: AudioSession | null = null;

export function rememberAudioSession(session: AudioSession): void {
  current = session;
}

export function getAudioSession(): AudioSession | null {
  return current;
}
