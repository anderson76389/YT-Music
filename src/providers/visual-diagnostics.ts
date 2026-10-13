import { clipboard, dialog, type BrowserWindow } from 'electron';

import * as config from '@/config';

/**
 * Diagnostic à exécuter dans la véritable page YouTube Music.
 * Les tests automatisés ne prouvent pas à eux seuls que les panneaux sont
 * visibles sur le PC de l'utilisateur.
 */
export async function showVisualDiagnostics(win: BrowserWindow) {
  const ambient = await config.plugins.isEnabled('ambient-mode');
  const transparent = await config.plugins.isEnabled('transparent-player');
  const themes = config.get('options.themes') ?? [];

  const state = await win.webContents.executeJavaScript(`
    (() => {
      const page = document.querySelector('#player-page, ytmusic-player-page');
      const ambientHost = document.querySelector('.ytmd-ambient-host');
      const backdrop = document.querySelector('.ytmd-ambient-backdrop');
      const result = {
        pageFound: !!page,
        ambientHost: !!ambientHost,
        ambientBackdrop: !!backdrop,
        ambientBlendMode: backdrop ? getComputedStyle(backdrop).mixBlendMode : 'absent',
        ambientOpacity: backdrop ? getComputedStyle(backdrop).opacity : 'absent',
        ambientZIndex: backdrop ? getComputedStyle(backdrop).zIndex : 'absent',
        ambientWidth: backdrop ? Math.round(backdrop.getBoundingClientRect().width) : 0,
        ambientArtwork: document.querySelector('.ytmd-ambient-art')?.getAttribute('src') ?? '',
        ambientCss: !!document.querySelector('style[data-ytmd-plugin="ambient-mode"]'),
        transparentCss: !!document.querySelector('style[data-ytmd-plugin="transparent-player"]'),
        transparentClass: document.body.classList.contains('transparent-player'),
        windowBackground: getComputedStyle(document.documentElement).backgroundColor,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        playerBackground: page ? getComputedStyle(page).backgroundColor : 'absent',
      };
      return result;
    })()
  `, true) as {
    pageFound: boolean;
    ambientHost: boolean;
    ambientBackdrop: boolean;
    ambientBlendMode: string;
    ambientOpacity: string;
    ambientZIndex: string;
    ambientWidth: number;
    ambientArtwork: string;
    ambientCss: boolean;
    transparentCss: boolean;
    transparentClass: boolean;
    windowBackground: string;
    bodyBackground: string;
    playerBackground: string;
  };

  const lines = [
    'YT Music — diagnostic visuel',
    `Mode ambiant activé : ${ambient ? 'oui' : 'non'}`,
    `Page du lecteur trouvée : ${state.pageFound ? 'oui' : 'non'}`,
    `Fond ambiant monté : ${state.ambientBackdrop ? 'oui' : 'non'}`,
    `Fond ambiant rendu : z-index ${state.ambientZIndex}, opacité ${state.ambientOpacity}, fusion ${state.ambientBlendMode}, largeur ${state.ambientWidth}px`,
    `Styles ambiants chargés : ${state.ambientCss ? 'oui' : 'non'}`,
    `Pochette du fond trouvée : ${state.ambientArtwork ? 'oui' : 'non'}`,
    `Mode transparent activé : ${transparent ? 'oui' : 'non'}`,
    `Classe CSS transparente active : ${state.transparentClass ? 'oui' : 'non'}`,
    `Styles transparents chargés : ${state.transparentCss ? 'oui' : 'non'}`,
    `Fond HTML : ${state.windowBackground}`,
    `Fond body : ${state.bodyBackground}`,
    `Fond page lecteur : ${state.playerBackground}`,
    `Thèmes CSS externes déclarés : ${themes.length}`,
  ];

  const message = lines.join('\n');
  const response = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Diagnostic des modes visuels',
    message: 'État réel des deux plugins dans cette fenêtre',
    detail: message,
    buttons: ['Fermer', 'Copier le diagnostic'],
  });
  if (response.response === 1) clipboard.writeText(message);
}
