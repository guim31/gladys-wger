// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// One wger account: the address of the server (wger.de or a self-hosted
// instance), the API key of the account, how often it is read, and the
// language of the names and texts.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Refresh intervals offered in the configuration, in minutes. A weigh-in or a
// workout happens a few times a day at most.
export const POLL_INTERVALS = ['15', '30', '60'];

export const DEFAULT_URL = 'https://wger.de';

export const DEFAULT_CONFIG = {
  url: DEFAULT_URL,
  api_key: '',
  poll_interval: '30',
  language: 'fr',
};

// Pages of the wger interface and API paths: a URL copied from the browser
// points at one of them, the server is the root.
const INTERFACE_PATH =
  /\/(api(\/.*)?|([a-z]{2}(-[a-z]{2,4})?\/)?(dashboard|routine|nutrition|weight|user|exercise|measurement|gallery|trophies)(\/.*)?|[a-z]{2}(-[a-z]{2,4})?)$/i;

/** Whether a host name is on the local network (the transport badge). */
export function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) {
    // IPv6: loopback, unique local (fc00::/7), link-local.
    return host === '::1' || /^f[cd]/.test(host) || host.startsWith('fe80');
  }
  if (!host.includes('.') || /\.(local|lan|home|internal|home\.arpa)$/.test(host)) {
    return true;
  }
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT, Tailscale
  );
}

/**
 * Parse the address typed by the user into a base URL: a bare host
 * (`wger.example.org`, `192.168.1.20:8000`), or a URL copied from the browser
 * (`https://wger.de/fr/dashboard`). HTTPS by default for a public host name,
 * HTTP for an IP address or a local name.
 * @param {unknown} raw
 * @returns {string|null} null when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const text = raw.trim();
  let withScheme = text;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const host = text.split(/[/:?]/)[0];
    const local = /^[\d.]+$/.test(host) || isPrivateHost(host);
    withScheme = `${local ? 'http' : 'https'}://${text}`;
  }
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs.
  if (url.username || url.password) {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, '').replace(INTERFACE_PATH, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Host part shown to the user and in the logs (no scheme, no path). */
export const hostOf = (url) => new URL(url).host;

/**
 * The platform id of an account: a digest of the server (host and path, the
 * scheme may change) and of the user name. Neither appears in the external id.
 */
export const accountIdOf = (url, username) =>
  createHash('sha256')
    .update(`gladys-wger:${url.replace(/^https?:\/\//, '').toLowerCase()}:${username}`)
    .digest('hex')
    .slice(0, 16);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const choice = (key, options) =>
    options.includes(String(source[key])) ? String(source[key]) : DEFAULT_CONFIG[key];
  const typed = text('url') || DEFAULT_URL;
  // The key as shown by wger ("Token 0123…" copied whole is accepted).
  const apiKey = text('api_key').replace(/^token\s+/i, '');
  return {
    // null: typed but not understood.
    url: parseServerUrl(typed),
    apiKey,
    pollIntervalMs: Number(choice('poll_interval', POLL_INTERVALS)) * 60_000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
