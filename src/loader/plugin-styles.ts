/**
 * Utilise des balises <style> plutôt que adoptedStyleSheets pour assurer
 * une insertion et une suppression fiables dans le document Electron actif.
 */
export function mountPluginStyles(
  doc: Document,
  id: string,
  styles: string[],
): void {
  unmountPluginStyles(doc, id);

  const head = doc.head ?? doc.documentElement;
  if (!head) return;

  for (const [index, css] of styles.entries()) {
    const tag = doc.createElement('style');
    tag.dataset.ytmdPlugin = id;
    tag.dataset.ytmdPluginStyleIndex = String(index);
    tag.textContent = css;
    head.appendChild(tag);
  }
}

export function unmountPluginStyles(doc: Document, id: string): void {
  for (const tag of doc.querySelectorAll<HTMLStyleElement>(
    'style[data-ytmd-plugin]',
  )) {
    if (tag.dataset.ytmdPlugin === id) tag.remove();
  }
}
