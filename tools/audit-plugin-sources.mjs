#!/usr/bin/env node
/**
 * Audit structurel reproductible des 31 extensions YT Music conservées.
 * Cette vérification garantit l'inventaire, les entrées et leur compilation,
 * pas le fonctionnement des services externes ou du DOM Google en direct.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('src/plugins');
const expected = [
  'album-actions', 'album-color-theme', 'ambient-mode',
  'anti-pause', 'audio-compressor', 'blur-nav-bar', 'captions-selector',
  'crossfade', 'custom-output-device', 'disable-autoplay', 'do-not-track',
  'downloader', 'equalizer', 'exponential-volume', 'in-app-menu',
  'navigation', 'notifications',
  'picture-in-picture', 'playback-speed', 'precise-volume',
  'quality-changer', 'skip-disliked-songs', 'skip-silences',
  'sponsorblock', 'taskbar-mediacontrol', 'touchbar',
  'transparent-player', 'tuna-obs', 'unobtrusive-player',
  'video-toggle', 'visualizer',
].sort();
const removed = [
  'amuse', 'performance-improvement',
  'auth-proxy-adapter', 'discord', 'clock', 'lumiastream',
  'music-together', 'shortcuts', 'scrobbler', 'api-server',
  'synced-lyrics',
];

const dirs = readdirSync(root, { withFileTypes: true })
  .filter((ent) => ent.isDirectory() && ent.name !== 'utils')
  .map((ent) => ent.name);
const standalone = readdirSync(root)
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
  .map((file) => file.replace(/\.(ts|tsx|js|jsx)$/, ''));
const actual = [...dirs, ...standalone].sort();

assert.deepEqual(actual, expected,
  'Une extension conservée a disparu, un plugin retiré est revenu ou un nouveau plugin manque dans l’audit');

for (const id of removed) {
  assert.equal(existsSync(join(root, id)), false, `Plugin supprimé revenu : ${id}`);
}

for (const id of actual) {
  const entry = [
    join(root, id, 'index.ts'), join(root, id, 'index.tsx'),
    join(root, `${id}.ts`), join(root, `${id}.tsx`),
  ].find((file) => existsSync(file));
  assert.ok(entry, `Fichier d'entrée introuvable : ${id}`);
  const code = readFileSync(entry, 'utf8');
  assert.match(code, /export\s+default\s+createPlugin\s*(?:<|\()/,
    `Le plugin ${id} n'exporte plus createPlugin`);
  assert.match(code, /\bname\s*:/,
    `Nom de plugin absent : ${id}`);
  console.log(`OK ${id}`);
}
console.log(`Audit structurel terminé : ${actual.length}/31 plugins présents.`);
