const TRUSTED_IMAGE_DOMAINS = ['ytimg.com', 'ggpht.com', 'googleusercontent.com', 'youtube.com'];

export function isTrustedArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      TRUSTED_IMAGE_DOMAINS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}
