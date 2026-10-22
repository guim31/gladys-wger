// -----------------------------------------------------------------------------
// wger client: the REST API v2 of a wger server (wger.de or self-hosted,
// AGPL-3.0, https://github.com/wger-project/wger), checked against wger
// 2.8.0-dev in Docker, the version wger.de runs (test/fixtures/wger):
//
//   GET  /api/v2/userprofile/                  the account: `username`,
//        `height` (cm, null when unknown), `weight_unit` ("kg" or "lb")
//   GET  /api/v2/weightentry/?ordering=-date   weigh-ins, newest first:
//        `id`, `date` (a date-time since 2.6, a plain date before),
//        `weight` (a decimal string, in the unit of the profile)
//   POST /api/v2/weightentry/                  `{ date, weight }`; wger
//        refuses a weight outside 20–350 kg with a 400
//   GET  /api/v2/workoutsession/?ordering=-datetime_start
//        workout sessions, newest first: `id`, `datetime_start` (`date`
//        before the routines of 2.3), `datetime_end`, `notes`, `routine`
//   GET  /api/v2/routine/<id>/                 the name of a routine
//   GET  /api/v2/nutritionplan/                the nutrition plans:
//        `goal_energy` (kcal, optional)
//   GET  /api/v2/nutritiondiary/?datetime__gte=…&datetime__lt=…
//        the food logged today; `/nutritiondiary/<id>/nutritional_values/`
//        gives the `energy` (kcal) of one entry
//
// Authentication: `Authorization: Token <key>`, the API key of the account
// (wger: user menu, API key). Redirects are not followed: the key would go
// wherever the address points. The key never appears in a log line.
// -----------------------------------------------------------------------------

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify
  AUTH: 'auth', // 401/403: the API key is missing or refused
  NOT_WGER: 'not_wger', // something answers, not the wger API
  REDIRECT: 'redirect', // the address redirects (usually HTTP to HTTPS)
  RATE_LIMITED: 'rate_limited', // 429
  SERVER: 'server', // 5xx
  HTTP: 'http', // any other HTTP error
});

export class WgerError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message English, for the logs (never contains a secret)
   * @param {object} [extra] { status, fields }
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'WgerError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * The one function that talks to the network (fetch). The client takes it as
 * a parameter: the tests replace it with an in-memory wger
 * (test/helpers/fakeWger.js).
 * @returns {Promise<{ status: number, body: string }>}
 */
export async function httpRequest(url, { method = 'GET', headers = {}, body, timeoutMs = 15_000 }) {
  const response = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    await response.body?.cancel();
    throw new Error('Response too large');
  }
  const text = await response.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error('Response too large');
  }
  return { status: response.status, body: text };
}

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** A date of wger in ms: a date-time, or a plain date (local midnight). */
export function parseDate(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const plain = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = plain
    ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])).getTime()
    : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

const resultsOf = (data) => {
  const list = Array.isArray(data) ? data : data?.results;
  if (!Array.isArray(list)) {
    throw new WgerError(ERROR_KINDS.NOT_WGER, 'The answer is not a wger list');
  }
  return list;
};

/** The parts of the user profile the integration uses. */
export function normalizeProfile(data) {
  if (!data || typeof data !== 'object' || typeof data.username !== 'string') {
    throw new WgerError(ERROR_KINDS.NOT_WGER, 'The answer is not a wger user profile');
  }
  const height = Number(data.height);
  return {
    username: data.username,
    // wger stores the height in cm; below 50 it is not one.
    heightCm: Number.isFinite(height) && height >= 50 && height <= 260 ? height : null,
    unit: data.weight_unit === 'lb' ? 'lb' : 'kg',
  };
}

/**
 * Weigh-ins, newest first, valid ones only.
 * @returns {{ id: string, date: number, weight: number }[]}
 */
export function normalizeWeights(data) {
  return resultsOf(data)
    .map((entry) => ({
      id: String(entry?.id ?? ''),
      date: parseDate(entry?.date),
      weight: Number(entry?.weight),
    }))
    .filter((entry) => entry.id && entry.date !== null && entry.weight > 0)
    .sort((a, b) => b.date - a.date);
}

/**
 * Workout sessions, newest first.
 * @returns {{ id: string, start: number, end: number|null, notes: string, routine: number|null }[]}
 */
export function normalizeSessions(data) {
  return resultsOf(data)
    .map((session) => ({
      id: String(session?.id ?? ''),
      start: parseDate(session?.datetime_start ?? session?.date),
      end: parseDate(session?.datetime_end),
      notes: clean(session?.notes, 120),
      routine: Number.isInteger(session?.routine) ? session.routine : null,
    }))
    .filter((session) => session.id && session.start !== null)
    .sort((a, b) => b.start - a.start);
}

/** The nutrition plans, newest first: `{ id, goalEnergy }`. */
export function normalizePlans(data) {
  return resultsOf(data).map((plan) => ({
    id: String(plan?.id ?? ''),
    goalEnergy:
      Number.isFinite(plan?.goal_energy) && plan.goal_energy > 0 ? plan.goal_energy : null,
  }));
}

export class WgerClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, `http(s)://host[:port][/path]`
   * @param {string} options.apiKey the API key of the account
   * @param {typeof httpRequest} [options.request] test seam
   * @param {number} [options.timeoutMs]
   */
  constructor({ url, apiKey, request = httpRequest, timeoutMs = 15_000 }) {
    this.url = url;
    this.apiKey = apiKey;
    this.request = request;
    this.timeoutMs = timeoutMs;
    /** @type {Map<number, string>} routine names, by id */
    this.routines = new Map();
  }

  async call(method, path, payload) {
    try {
      return await this.request(`${this.url}/api/v2${path}`, {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Token ${this.apiKey}`,
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        timeoutMs: this.timeoutMs,
      });
    } catch (err) {
      const code = err.cause?.code ?? err.code;
      if (TLS_CODES.has(code)) {
        throw new WgerError(ERROR_KINDS.TLS, `Certificate refused (${code})`);
      }
      throw new WgerError(ERROR_KINDS.UNREACHABLE, code ?? err.name ?? 'No answer');
    }
  }

  /** The parsed JSON of a request; a 400 carries wger's field errors. */
  async json(method, path, payload) {
    const { status, body } = await this.call(method, path, payload);
    if (status === 401 || status === 403) {
      throw new WgerError(ERROR_KINDS.AUTH, `Access refused (HTTP ${status})`, { status });
    }
    if (status >= 300 && status < 400) {
      throw new WgerError(ERROR_KINDS.REDIRECT, `Redirected (HTTP ${status})`, { status });
    }
    if (status === 404) {
      throw new WgerError(ERROR_KINDS.NOT_WGER, 'No wger API here (HTTP 404)', { status });
    }
    if (status === 429) {
      throw new WgerError(ERROR_KINDS.RATE_LIMITED, 'Too many requests (HTTP 429)', { status });
    }
    if (status >= 500) {
      throw new WgerError(ERROR_KINDS.SERVER, `wger error (HTTP ${status})`, { status });
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new WgerError(ERROR_KINDS.NOT_WGER, 'The answer is not JSON', { status });
    }
    if (status < 200 || status >= 300) {
      throw new WgerError(ERROR_KINDS.HTTP, `Unexpected answer (HTTP ${status})`, {
        status,
        fields: status === 400 && data && typeof data === 'object' ? data : null,
      });
    }
    return data;
  }

  async profile() {
    return normalizeProfile(await this.json('GET', '/userprofile/'));
  }

  /** The last 100 weigh-ins (two or three months for most users). */
  async weights() {
    return normalizeWeights(await this.json('GET', '/weightentry/?ordering=-date&limit=100'));
  }

  /** The last 50 workout sessions. */
  async sessions() {
    return normalizeSessions(
      await this.json('GET', '/workoutsession/?ordering=-datetime_start&limit=50'),
    );
  }

  /** The name of a routine, read once per id (empty when unreadable). */
  async routineName(id) {
    if (!this.routines.has(id)) {
      let name = '';
      try {
        name = clean((await this.json('GET', `/routine/${id}/`))?.name, 60);
      } catch (err) {
        if (err.kind !== ERROR_KINDS.NOT_WGER) {
          throw err;
        }
      }
      this.routines.set(id, name);
    }
    return this.routines.get(id);
  }

  async plans() {
    return normalizePlans(
      await this.json('GET', '/nutritionplan/?ordering=-creation_date&limit=10'),
    );
  }

  /**
   * The food logged between two instants: `{ id, key }`, `key` changing when
   * the entry is edited (its energy is read again).
   */
  async diary(from, to) {
    const query = `datetime__gte=${encodeURIComponent(new Date(from).toISOString())}&datetime__lt=${encodeURIComponent(new Date(to).toISOString())}&limit=200`;
    return resultsOf(await this.json('GET', `/nutritiondiary/?${query}`))
      .filter((entry) => entry?.id !== undefined && entry?.id !== null)
      .map((entry) => ({
        id: String(entry.id),
        key: `${entry.id}:${entry.ingredient}:${entry.amount}:${entry.weight_unit}`,
      }));
  }

  /** The energy (kcal) of one diary entry. */
  async diaryEnergy(id) {
    const data = await this.json(
      'GET',
      `/nutritiondiary/${encodeURIComponent(id)}/nutritional_values/`,
    );
    const energy = Number(data?.energy);
    return Number.isFinite(energy) && energy >= 0 ? energy : 0;
  }

  /** Add a weigh-in; resolves the entry as wger stored it. */
  async addWeight(weight, date) {
    const payload = { weight: weight.toFixed(2), date: new Date(date).toISOString() };
    let data;
    try {
      data = await this.json('POST', '/weightentry/', payload);
    } catch (err) {
      // Before 2.6 the date of a weigh-in was a plain date.
      if (!err.fields?.date) {
        throw err;
      }
      const day = new Date(date);
      const plain = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      data = await this.json('POST', '/weightentry/', { ...payload, date: plain });
    }
    return normalizeWeights([data])[0] ?? null;
  }
}
