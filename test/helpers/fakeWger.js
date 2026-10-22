// -----------------------------------------------------------------------------
// An in-memory wger server for the tests, started from the real answers of
// wger 2.8.0-dev in Docker (test/fixtures/wger): a profile in kg with a
// height of 178 cm, seven weigh-ins from 82.4 to 79.8 kg over six weeks,
// three workout sessions (one of the "Full body" routine, one with notes
// only), one nutrition plan with a goal of 2400 kcal and 80 g of oats logged
// today (296 kcal).
//
// Access as on a real server: `Authorization: Token <key>`, 403 otherwise,
// the body of the real 403. The tests change it (`addWeight`, `addSession`,
// `down = true`, `statuses['/userprofile/'] = 500`) and read it through
// `request`, the HTTP seam of the client.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const BASE = 'http://192.0.2.10:8000';
export const API_KEY = '0123456789abcdef0123456789abcdef01234567';
// The time of the fixtures: noon in Paris, the day of the last weigh-in.
export const FIXTURE_TIME = Date.parse('2026-10-22T12:00:00+02:00');

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/wger/${name}`, import.meta.url), 'utf8'));

const page = (results) => ({ count: results.length, next: null, previous: null, results });

export class FakeWger {
  constructor() {
    this.profile = fixture('userprofile.json');
    this.weights = fixture('weightentry.json').results;
    this.sessions = fixture('workoutsession.json').results;
    this.plans = fixture('nutritionplan.json').results;
    this.diary = fixture('nutritiondiary-today.json').results;
    this.energy = fixture('nutritiondiary-values.json');
    this.down = false;
    /** @type {Record<string, number>} forced HTTP statuses, by path prefix */
    this.statuses = {};
    this.calls = [];
    this.posted = [];
    this.request = this.request.bind(this);
  }

  addWeight(weight, date) {
    this.weights.unshift({ id: `w-${date}`, date, weight: weight.toFixed(2), user: 2 });
  }

  addSession(start, { notes = '', end = null, routine = null } = {}) {
    this.sessions.unshift({
      id: `s-${start}`,
      routine,
      day: null,
      notes,
      impression: '2',
      datetime_start: start,
      datetime_end: end,
    });
  }

  json(status, body) {
    return { status, body: JSON.stringify(body) };
  }

  async request(url, { method = 'GET', headers = {}, body } = {}) {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/api\/v2/, '');
    this.calls.push(`${method} ${path}`);
    if (this.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }
    if (headers.authorization !== `Token ${API_KEY}`) {
      return this.json(403, fixture('invalid-token.json'));
    }
    for (const [prefix, status] of Object.entries(this.statuses)) {
      if (path.startsWith(prefix)) {
        return { status, body: status === 429 ? '{"detail":"Throttled."}' : 'error' };
      }
    }
    const query = parsed.searchParams;
    if (method === 'POST' && path === '/weightentry/') {
      const data = JSON.parse(body);
      const weight = Number(data.weight);
      if (!(weight >= 20 && weight <= 350)) {
        return this.json(400, { weight: ['Weight must be between 20 and 350 kg'] });
      }
      this.posted.push(data);
      this.addWeight(weight, data.date);
      return this.json(201, this.weights[0]);
    }
    if (path === '/userprofile/') {
      return this.json(200, this.profile);
    }
    if (path === '/weightentry/') {
      const sorted = [...this.weights].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      return this.json(200, page(sorted));
    }
    if (path === '/workoutsession/') {
      const sorted = [...this.sessions].sort(
        (a, b) => Date.parse(b.datetime_start) - Date.parse(a.datetime_start),
      );
      return this.json(200, page(sorted));
    }
    if (path === '/routine/1/') {
      return this.json(200, { id: 1, name: 'Full body' });
    }
    if (path === '/nutritionplan/') {
      return this.json(200, page(this.plans));
    }
    if (path === '/nutritiondiary/') {
      const from = Date.parse(query.get('datetime__gte'));
      const to = Date.parse(query.get('datetime__lt'));
      return this.json(
        200,
        page(
          this.diary.filter((e) => Date.parse(e.datetime) >= from && Date.parse(e.datetime) < to),
        ),
      );
    }
    if (/^\/nutritiondiary\/[^/]+\/nutritional_values\/$/.test(path)) {
      return this.json(200, this.energy);
    }
    return this.json(404, { detail: 'Not found.' });
  }
}
