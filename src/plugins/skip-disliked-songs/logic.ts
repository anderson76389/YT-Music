/** Reconnaît l'état réellement marqué « je n'aime pas ».
 * Ne pas confondre le bouton J'aime et le bouton Je n'aime pas.
 */
export function isDislikedButton(button: Element | null): boolean {
  return button?.getAttribute('like-status') === 'DISLIKE' ||
    (button?.getAttribute('aria-pressed') === 'true' &&
      button?.getAttribute('id') === 'button-shape-dislike');
}
