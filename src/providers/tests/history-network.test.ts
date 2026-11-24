import { ElectronBlocker, Request } from '@ghostery/adblocker-electron';
import { expect, test } from '@playwright/test';

import { preserveNativeHistory } from '../history-network';

test('les requêtes natives d’historique restent autorisées sans débloquer les autres stats', () => {
  const blocker = ElectronBlocker.parse('||s.youtube.com/api/stats/\n||music.youtube.com/api/stats/\n||doubleclick.net^');
  preserveNativeHistory(blocker);
  const blocked = (url: string) => blocker.match(Request.fromRawDetails({ url, type: 'xmlhttprequest', sourceUrl: 'https://music.youtube.com/' })).match;
  for (const host of ['s.youtube.com', 'music.youtube.com']) {
    expect(blocked(`https://${host}/api/stats/playback?docid=example`)).toBe(false);
    expect(blocked(`https://${host}/api/stats/watchtime?docid=example`)).toBe(false);
    expect(blocked(`https://${host}/api/stats/qoe?docid=example`)).toBe(true);
  }
  expect(blocked('https://doubleclick.net/ads')).toBe(true);
});
