import { expect, test } from '@playwright/test';
import { Window } from 'happy-dom';

import { mountPluginStyles, unmountPluginStyles } from '../plugin-styles';

test('Mode ambiant insère ses CSS, puis disparaît à la désactivation', () => {
  const window = new Window();
  const doc = window.document as unknown as Document;
  mountPluginStyles(doc, 'ambient-mode', [
    '.ytmd-ambient-backdrop { background: red }',
  ]);
  expect(doc.querySelectorAll('style[data-ytmd-plugin="ambient-mode"]')).toHaveLength(1);
  expect(doc.querySelector('style')?.textContent).toContain('background: red');

  unmountPluginStyles(doc, 'ambient-mode');
  expect(doc.querySelectorAll('style[data-ytmd-plugin="ambient-mode"]')).toHaveLength(0);
  void window.close();
});

test('Mode transparent remplace ses anciens styles, sans affecter Anti-Pause', () => {
  const window = new Window();
  const doc = window.document as unknown as Document;
  mountPluginStyles(doc, 'anti-pause', ['.ad { display: none }']);
  mountPluginStyles(doc, 'transparent-player', ['body.transparent-player { opacity: 0.5 }']);
  mountPluginStyles(doc, 'transparent-player', ['body.transparent-player { opacity: 0.8 }']);

  const transparent = doc.querySelectorAll('style[data-ytmd-plugin="transparent-player"]');
  expect(transparent).toHaveLength(1);
  expect(transparent[0].textContent).toContain('opacity: 0.8');
  expect(doc.querySelectorAll('style[data-ytmd-plugin="anti-pause"]')).toHaveLength(1);

  unmountPluginStyles(doc, 'transparent-player');
  expect(doc.querySelectorAll('style[data-ytmd-plugin="anti-pause"]')).toHaveLength(1);
  void window.close();
});
