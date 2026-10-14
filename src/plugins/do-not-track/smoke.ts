import { createServer } from 'node:http';

import { ElectronBlocker } from '@ghostery/adblocker-electron';

import type { BrowserWindow } from 'electron';

/** Windows release-only integration test.
 *
 * An isolated local HTTP server receives an ordinary Chromium request.
 * A rule with the exact matching URL is then installed into the actual
 * Electron session. Only a request not delivered to the server proves
 * the native network hook is blocking.
 *
 * This does NOT claim that every tracker is present in downloaded lists.
 */
export async function verifyTrackerNetworkBlocking(win: BrowserWindow): Promise<boolean> {
  let received = 0;
  const server = createServer((_request, response) => {
    received++;
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain',
    });
    response.end('ytmd-tracker-probe-ok');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Cannot determine the local tracker probe port');
  }

  const target = `http://127.0.0.1:${address.port}/ytmd-tracker-probe`;
  const runFetch = async (stage: string) => {
    const targetUrl = `${target}?stage=${stage}`;
    // The call runs in the REAL renderer attached to the Electron session.
    return Boolean(await win.webContents.executeJavaScript(
      `fetch(${JSON.stringify(targetUrl)}, {cache:'no-store'})
        .then(async r => r.ok && (await r.text()) === 'ytmd-tracker-probe-ok')
        .catch(() => false)`,
      true,
    ));
  };

  let tracker: ElectronBlocker | null = null;
  try {
    const baseline = await runFetch('before');
    const deliveredBefore = received;
    tracker = ElectronBlocker.parse('||127.0.0.1^$xmlhttprequest');
    if (tracker.getFilters().networkFilters.length === 0) return false;
    tracker.enableBlockingInSession(win.webContents.session);
    if (!tracker.isBlockingEnabled(win.webContents.session)) return false;
    const blockedFetchSucceeded = await runFetch('blocked');
    const deliveredWhileBlocked = received;
    tracker.disableBlockingInSession(win.webContents.session);
    const restored = await runFetch('after');
    const deliveredAfter = received;

    return baseline && deliveredBefore === 1 &&
      !blockedFetchSucceeded && deliveredWhileBlocked === 1 &&
      restored && deliveredAfter === 2;
  } finally {
    if (tracker?.isBlockingEnabled(win.webContents.session)) {
      tracker.disableBlockingInSession(win.webContents.session);
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
  }
}
