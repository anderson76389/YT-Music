/** Visual preferences from Pear Desktop; one reusable style node.
 * Applying the same configuration twice must never stack CSS or listeners.
 */
export type AppearanceOptions = {
  removeUpgradeButton: boolean;
  likeButtons: string;
  swapLikeButtonsOrder: boolean;
};

export const SETTINGS_STYLE_ID = 'ytmd-settings-appearance';

export function buildAppearanceStyles(
  options: AppearanceOptions,
  upgradeSelector = 'ytmusic-guide-entry-renderer:last-child',
): string {
  const rules: string[] = [];
  if (options.removeUpgradeButton) {
    rules.push(`ytmusic-guide-section-renderer #items ${upgradeSelector} { display: none !important; }`);
  }
  if (options.likeButtons === 'force' || options.likeButtons === 'hide') {
    const hide = options.likeButtons === 'hide';
    rules.push(`ytmusic-player-bar[is-mweb-player-bar-modernization-enabled] .middle-controls-buttons.ytmusic-player-bar, #like-button-renderer {
      display: ${hide ? 'none' : 'inherit'} !important;
    }
    ytmusic-player-bar[is-mweb-player-bar-modernization-enabled] .middle-controls.ytmusic-player-bar {
      justify-content: ${hide ? 'flex-start' : 'space-between'} !important;
    }`);
  }
  if (options.swapLikeButtonsOrder && options.likeButtons !== 'hide') {
    rules.push('#like-button-renderer { display: inline-flex; flex-direction: row-reverse; }');
  }
  return rules.join('\n');
}

export function applyAppearanceOptions(doc: Document, options: AppearanceOptions): void {
  let selector = 'ytmusic-guide-entry-renderer:last-child';
  const symbol = doc.querySelector<SVGElement>(
    'iron-iconset-svg[name="yt-sys-icons"] #youtube_music_monochrome',
  );
  const first = symbol?.firstElementChild;
  if (first?.tagName.toLowerCase() === 'path') {
    const data = first.getAttribute('d');
    if (data && data.length >= 15) {
      selector = `ytmusic-guide-entry-renderer:has(> tp-yt-paper-item > yt-icon path[d^="${data.substring(0, 15)}"])`;
    }
  }
  const css = buildAppearanceStyles(options, selector);
  let style = doc.getElementById(SETTINGS_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = doc.createElement('style');
    style.id = SETTINGS_STYLE_ID;
    doc.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}
