/**
 * L'animation du fond utilise les images de la vidéo seulement lorsqu'elles
 * existent et sont visibles. Le fond de pochette reste affiché autrement.
 */
export function canDrawAmbientVideo(
  video: HTMLVideoElement | null,
  visible: boolean,
): video is HTMLVideoElement {
  return Boolean(
    video &&
    visible &&
    !video.paused &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}
