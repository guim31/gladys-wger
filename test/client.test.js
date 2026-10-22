// -----------------------------------------------------------------------------
// The wger client and the configuration, on the real answers of wger 2.8 in
// Docker (test/fixtures/wger) and on the older shapes (plain dates).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseServerUrl } from '../src/config.js';
import { bmiOf, parseDay, parseWeight, startOfWeek, weightChange } from '../src/stats.js';
import {
  ERROR_KINDS,
  WgerClient,
  normalizeSessions,
  normalizeWeights,
} from '../src/wger/client.js';
import { API_KEY, BASE, FakeWger } from './helpers/fakeWger.js';

const clientOf = (wger, apiKey = API_KEY) =>
  new WgerClient({ url: BASE, apiKey, request: wger.request });

test('the real answers are read', async () => {
  const client = clientOf(new FakeWger());
  assert.deepEqual(await client.profile(), { username: 'athlete', heightCm: 178, unit: 'kg' });
  const weights = await client.weights();
  assert.equal(weights.length, 7);
  assert.deepEqual(weights[0], {
    id: '01a16347-4611-79ba-9496-20648d848793',
    date: Date.parse('2026-10-22T07:15:00+02:00'),
    weight: 79.8,
  });
  const sessions = await client.sessions();
  assert.equal(sessions[0].notes, 'Course 5 km');
  assert.equal(sessions[0].end, null);
  assert.equal(sessions[1].routine, 1);
  assert.equal(await client.routineName(1), 'Full body');
  assert.deepEqual(await client.plans(), [
    { id: '01a16347-1617-7038-b83e-06b6b1dc5648', goalEnergy: 2400 },
  ]);
});

test('older wger: plain dates for weigh-ins and sessions', () => {
  const [weight] = normalizeWeights([{ id: 3, date: '2023-05-02', weight: '81.30' }]);
  assert.equal(new Date(weight.date).getHours(), 0);
  assert.equal(weight.weight, 81.3);
  const [session] = normalizeSessions({ results: [{ id: 9, date: '2023-05-01', notes: ' ' }] });
  assert.equal(session.notes, '');
  assert.equal(new Date(session.start).getDate(), 1);
});

test('errors become kinds, without the key in the message', async () => {
  const wger = new FakeWger();
  const kindOf = async (fn) => {
    try {
      await fn();
    } catch (err) {
      assert.ok(!err.message.includes(API_KEY));
      return err.kind;
    }
    return null;
  };
  assert.equal(await kindOf(() => clientOf(wger, 'nope').profile()), ERROR_KINDS.AUTH);
  wger.statuses['/userprofile/'] = 500;
  assert.equal(await kindOf(() => clientOf(wger).profile()), ERROR_KINDS.SERVER);
  wger.statuses['/userprofile/'] = 429;
  assert.equal(await kindOf(() => clientOf(wger).profile()), ERROR_KINDS.RATE_LIMITED);
  wger.statuses['/userprofile/'] = 301;
  assert.equal(await kindOf(() => clientOf(wger).profile()), ERROR_KINDS.REDIRECT);
  delete wger.statuses['/userprofile/'];
  wger.down = true;
  assert.equal(await kindOf(() => clientOf(wger).profile()), ERROR_KINDS.UNREACHABLE);
  const html = async () => ({ status: 200, body: '<html>' });
  const notWger = new WgerClient({ url: BASE, apiKey: API_KEY, request: html });
  assert.equal(await kindOf(() => notWger.profile()), ERROR_KINDS.NOT_WGER);
});

test('a weigh-in is posted, and again with a plain date on an older wger', async () => {
  const wger = new FakeWger();
  const client = clientOf(wger);
  const date = Date.parse('2026-10-22T08:00:00+02:00');
  const added = await client.addWeight(79.5, date);
  assert.equal(added.weight, 79.5);
  assert.deepEqual(wger.posted, [{ weight: '79.50', date: '2026-10-22T06:00:00.000Z' }]);

  const bodies = [];
  const old = async (url, { body }) => {
    const data = JSON.parse(body);
    bodies.push(data);
    return data.date.includes('T')
      ? { status: 400, body: '{"date":["Date has wrong format."]}' }
      : { status: 201, body: JSON.stringify({ id: 4, ...data }) };
  };
  const oldClient = new WgerClient({ url: BASE, apiKey: API_KEY, request: old });
  await oldClient.addWeight(80, date);
  assert.equal(bodies[1].date, '2026-10-22');

  // wger's own bound: refused, not retried.
  await assert.rejects(client.addWeight(400, date), (err) => Boolean(err.fields?.weight));
});

test('the address: wger.de by default, pages of the interface, local servers', () => {
  assert.equal(normalizeConfig({}).url, 'https://wger.de');
  assert.equal(parseServerUrl('https://wger.de/fr/dashboard'), 'https://wger.de');
  assert.equal(parseServerUrl('wger.de/en/weight/overview/'), 'https://wger.de');
  assert.equal(parseServerUrl('192.168.1.20:8000'), 'http://192.168.1.20:8000');
  assert.equal(parseServerUrl('https://example.org/wger/api/v2/'), 'https://example.org/wger');
  assert.equal(parseServerUrl('https://user:pass@example.org'), null);
  assert.equal(normalizeConfig({ url: 'ftp://x' }).url, null);
  assert.equal(normalizeConfig({ api_key: ' Token abc ' }).apiKey, 'abc');
  assert.equal(normalizeConfig({ poll_interval: '5' }).pollIntervalMs, 30 * 60_000);
});

test('weights, days and changes', () => {
  assert.equal(parseWeight('79,8'), 79.8);
  assert.equal(parseWeight(' 80.25 kg'), 80.25);
  assert.equal(parseWeight('176 lbs', 'lb'), 176);
  // A unit that is not the one of the profile is never converted: refused.
  assert.equal(parseWeight('176 lb', 'kg'), null);
  assert.equal(parseWeight('-3'), null);
  assert.equal(parseWeight('1e3'), null);
  const now = Date.parse('2026-10-22T12:00:00+02:00');
  assert.equal(parseDay('', now), now);
  assert.equal(parseDay('2026-02-30', now), null);
  assert.equal(new Date(parseDay('2026-10-20', now)).getHours(), 12);
  // Today, typed: now, not noon (a morning weigh-in is not in the future).
  const morning = Date.parse('2026-10-22T08:00:00+02:00');
  assert.equal(parseDay('2026-10-22', morning), morning);
  assert.equal(bmiOf(176, 'lb', 178), 25.2);
  assert.equal(bmiOf(80, 'kg', null), null);
  // Monday 19 October 2026, local midnight.
  assert.equal(startOfWeek(now), Date.parse('2026-10-19T00:00:00+02:00'));
  const day = 86_400_000;
  const weights = [
    { date: now, weight: 80 },
    { date: now - 40 * day, weight: 82 },
  ];
  // The only older weigh-in is 40 days old: no change over 7 days.
  assert.equal(weightChange(weights, 7), null);
  assert.equal(weightChange(weights, 30), -2);
  // Calendar days across the start of DST (28 March 2027): 1 April 00:30
  // against 25 March, not 24.
  const dst = [
    { date: Date.parse('2027-04-01T00:30:00+02:00'), weight: 80 },
    { date: Date.parse('2027-03-25T07:00:00+01:00'), weight: 81 },
    { date: Date.parse('2027-03-24T07:00:00+01:00'), weight: 82 },
  ];
  assert.equal(weightChange(dst, 7), -1);
});
