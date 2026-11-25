import { expect, test } from '@playwright/test';

import { BoundedCache } from '../bounded-cache';
import { LatestRequest } from '../latest-request';
import { isTrustedArtworkUrl } from '../trusted-artwork-url';

test('LRU releases old covers and stays bounded over thousands of changes', () => {
  const cache = new BoundedCache<number, string>(12, 24 * 1024 * 1024);
  let maxEntries = 0;
  let maxWeight = 0;
  for (let i = 0; i < 43200; i++) {
    cache.set(i, String(i), 2 * 1024 * 1024);
    maxEntries = Math.max(maxEntries, cache.size);
    maxWeight = Math.max(maxWeight, cache.totalWeight);
  }
  expect(maxEntries).toBeLessThanOrEqual(12);
  expect(maxWeight).toBeLessThanOrEqual(24 * 1024 * 1024);
  expect(cache.get(0)).toBeUndefined();
  expect(cache.get(43199)).toBe('43199');
  cache.set(43200, 'oversized', 25 * 1024 * 1024);
  expect(cache.get(43200)).toBeUndefined();
  cache.clear();
  expect(cache.size).toBe(0);
  expect(cache.totalWeight).toBe(0);
});

test('LRU refreshes use order and correctly accounts for replacement', () => {
  const cache = new BoundedCache<string, number>(2, 8);
  cache.set('a', 1, 3);
  cache.set('b', 2, 3);
  expect(cache.get('a')).toBe(1);
  cache.set('c', 3, 3);
  expect(cache.get('b')).toBeUndefined();
  cache.set('a', 4, 2);
  expect(cache.totalWeight).toBe(5);
  expect(cache.get('a')).toBe(4);
});

test('rapid track changes invalidate old metadata even if it completes late', async () => {
  const request = new LatestRequest();
  const old = request.begin();
  const latest = request.begin();
  expect(old.aborted).toBe(true);
  expect(request.isCurrent(old)).toBe(false);
  expect(request.isCurrent(latest)).toBe(true);
  await Promise.resolve();
  expect(request.isCurrent(old)).toBe(false);
  request.cancel();
  expect(latest.aborted).toBe(true);
  expect(request.isCurrent(latest)).toBe(false);
});

test('native cover downloads cannot address arbitrary hosts, ports or local files', () => {
  for (const url of [
    'https://i.ytimg.com/vi/a/hqdefault.jpg',
    'https://lh3.googleusercontent.com/cover',
    'https://yt3.ggpht.com/cover',
  ]) expect(isTrustedArtworkUrl(url)).toBe(true);
  for (const url of [
    'http://i.ytimg.com/cover',
    'https://ytimg.com.evil.example/cover',
    'https://fake-ytimg.com/cover',
    'https://user:password@i.ytimg.com/cover',
    'https://i.ytimg.com:1234/cover',
    'http://127.0.0.1/private',
    'file:///C:/Users/private',
  ]) expect(isTrustedArtworkUrl(url)).toBe(false);
});
