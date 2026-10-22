// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and an in-memory
// wger built from real answers (test/helpers): discovery, states, scene
// events, scene actions, widget, errors, quiet logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FEATURE_KEYS as K } from '../src/devices.js';
import { TRIGGERS, WIDGET_KEY } from '../src/hub.js';
import { DAY_MS } from '../src/stats.js';
import { WEIGHT_TEXT } from '../src/texts.js';
import { ACTIONS } from '../src/widgets.js';
import { API_KEY, BASE, createDevices, createWorld, idsOf } from './helpers/world.js';

const iso = (time) => new Date(time).toISOString();

/** The last state published for a feature key. */
function stateOf(world, key) {
  const id = idsOf(world).feature(key);
  const states = world.fake.states.filter((s) => s.device_feature_external_id === id);
  return states.at(-1);
}

test('one device is discovered, with the values of the account', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.name, 'wger athlete');
  assert.equal(device.should_poll, false);
  const keys = device.features.map((f) => f.external_id.split(':').at(-1));
  assert.deepEqual(keys, [
    K.WEIGHT_KG,
    K.CHANGE_7D_KG,
    K.CHANGE_30D_KG,
    K.BMI,
    K.DAYS_SINCE_WEIGHING,
    K.WORKOUTS_WEEK,
    K.DAYS_SINCE_WORKOUT,
    K.LAST_WORKOUT,
    K.CALORIES_TODAY,
  ]);
  assert.equal(world.fake.connectionStatus.connected, true);
  // The external ids say nothing of the account (a digest).
  assert.ok(!device.external_id.includes('athlete'));
  assert.ok(!device.external_id.includes('192.0.2.10'));
});

test('the device states, published once created, then only what changes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.fake.states.length, 0, 'nothing before the device is added');
  await createDevices(world);
  // 79.8 kg today; 80.5 on the 15th (7 days before); 81.9 on 20 Sept (30+ days).
  assert.equal(stateOf(world, K.WEIGHT_KG).state, 79.8);
  assert.equal(stateOf(world, K.CHANGE_7D_KG).state, -0.7);
  assert.equal(stateOf(world, K.CHANGE_30D_KG).state, -2.1);
  // 79.8 / 1.78² = 25.19
  assert.equal(stateOf(world, K.BMI).state, 25.2);
  assert.equal(stateOf(world, K.DAYS_SINCE_WEIGHING).state, 0);
  // Monday 20 and Wednesday 22 October; the 14th was the week before.
  assert.equal(stateOf(world, K.WORKOUTS_WEEK).state, 2);
  assert.equal(stateOf(world, K.DAYS_SINCE_WORKOUT).state, 0);
  assert.equal(stateOf(world, K.LAST_WORKOUT).text, 'Thu 22/10 · Course 5 km');
  // 80 g of oats at 370 kcal / 100 g.
  assert.equal(stateOf(world, K.CALORIES_TODAY).state, 296);
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));

  const count = world.fake.states.length;
  await world.hub.pollNow();
  assert.equal(world.fake.states.length, count, 'nothing changed, nothing sent');
  // The energy of an entry already read is not asked again.
  const diaryValues = world.wger.calls.filter((c) => c.includes('nutritional_values')).length;
  assert.equal(diaryValues, 1);

  world.clock.advance(2 * DAY_MS);
  await world.hub.pollNow();
  assert.equal(stateOf(world, K.DAYS_SINCE_WEIGHING).state, 2);
  assert.equal(stateOf(world, K.DAYS_SINCE_WORKOUT).state, 2);
  // A new day: nothing logged yet.
  assert.equal(stateOf(world, K.CALORIES_TODAY).state, 0);
});

test('a new weigh-in and a new workout fire their scene events, once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.sceneEvents, [], 'the first reading only sets the state');
  world.clock.advance(3600_000);
  world.wger.addWeight(79.4, iso(world.clock.now()));
  world.wger.addSession(iso(world.clock.now()), {
    end: iso(world.clock.now() + 45 * 60_000),
    routine: 1,
  });
  await world.hub.pollNow();
  await world.hub.pollNow();
  const [weight, workout] = world.fake.sceneEvents;
  assert.equal(world.fake.sceneEvents.length, 2);
  assert.equal(weight.key, TRIGGERS.WEIGHT_ADDED);
  assert.deepEqual(weight.data, {
    device: idsOf(world).device,
    device_name: 'wger athlete',
    weight: 79.4,
    unit: 'kg',
    change_7d: -1.1,
    bmi: 25.1,
    date: '2026-10-22',
  });
  assert.equal(workout.key, TRIGGERS.WORKOUT_LOGGED);
  assert.equal(workout.data.notes, 'Full body');
  assert.equal(workout.data.duration_minutes, 45);
  assert.equal(workout.data.workouts_week, 3);
});

test('"no workout" fires once per threshold, survives a restart, resets on a workout', async (t) => {
  const first = await createWorld();
  first.clock.advance(4 * DAY_MS);
  await first.hub.pollNow();
  await first.app.stop();
  const days = () => first.fake.sceneEvents.map((e) => e.data.days);
  assert.deepEqual(days(), ['2', '3']);

  // The integration restarts the next day: 2 and 3 are not announced again.
  const world = await createWorld({ dataDir: first.dataDir, wger: first.wger });
  t.after(() => world.app.stop());
  world.clock.advance(5 * DAY_MS);
  await world.hub.pollNow();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.days, e.data.days_since_workout]),
    [[TRIGGERS.NO_WORKOUT, '5', 5]],
  );
  // A workout: a new silence starts.
  world.wger.addSession(iso(world.clock.now()), { notes: 'Swim' });
  await world.hub.pollNow();
  world.clock.advance(2 * DAY_MS);
  await world.hub.pollNow();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => e.data.days ?? e.key),
    ['5', TRIGGERS.WORKOUT_LOGGED, '2'],
  );
});

test('a first reading long after the last workout announces nothing', async (t) => {
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  world.clock.advance(20 * DAY_MS);
  await world.gladys.connect();
  await world.app.ready;
  world.clock.advance(3600_000);
  await world.hub.pollNow();
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('add a weigh-in from a scene: comma, today, read again at once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('add_weight', { weight: '79,5 kg' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    added: true,
    weight: 79.5,
    unit: 'kg',
    date: '2026-10-22',
    change_7d: -1,
    message: WEIGHT_TEXT.added.en,
  });
  assert.equal(world.wger.posted.length, 1);
  assert.equal(world.wger.posted[0].weight, '79.50');
  assert.equal(world.fake.sceneEvents.at(-1).key, TRIGGERS.WEIGHT_ADDED);

  // The same scene run twice: not added again.
  const again = await world.fake.sceneAction('add_weight', { weight: '79.5' });
  assert.equal(again.data.outputs.added, false);
  assert.equal(world.wger.posted.length, 1);

  // A given day, at noon local time.
  const dated = await world.fake.sceneAction('add_weight', {
    weight: '80.2',
    date: '20/10/2026',
  });
  assert.equal(dated.success, true, dated.error);
  assert.equal(world.wger.posted[1].date, '2026-10-20T10:00:00.000Z');
});

test('add a weigh-in: implausible values are refused', async (t) => {
  const world = await createWorld({
    config: { url: BASE, api_key: API_KEY, language: 'fr' },
  });
  t.after(() => world.app.stop());
  const refused = async (fields, text) => {
    const ack = await world.fake.sceneAction('add_weight', fields);
    assert.equal(ack.success, false, JSON.stringify(fields));
    assert.equal(ack.error, text.fr);
  };
  await refused({ weight: 'abc' }, WEIGHT_TEXT.notNumber);
  await refused({ weight: '' }, WEIGHT_TEXT.notNumber);
  await refused({ weight: '12' }, WEIGHT_TEXT.outOfRange);
  await refused({ weight: '400' }, WEIGHT_TEXT.outOfRange);
  // The cat on the scale, a child: more than 10 % from 79.8.
  await refused({ weight: '68' }, WEIGHT_TEXT.tooFar);
  await refused({ weight: '80', date: '31/02/2026' }, WEIGHT_TEXT.badDate);
  await refused({ weight: '80', date: '2026-10-30' }, WEIGHT_TEXT.future);
  assert.equal(world.wger.posted.length, 0);
  // The check can be turned off (a real change after an illness, a lb mistake fixed).
  const ack = await world.fake.sceneAction('add_weight', { weight: '70', check_change: false });
  assert.equal(ack.success, true, ack.error);
});

test('the week summary of a scene', async (t) => {
  const world = await createWorld({
    config: { url: BASE, api_key: API_KEY, language: 'fr' },
  });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('get_week_summary', {});
  assert.equal(ack.success, true, ack.error);
  const outputs = ack.data.outputs;
  assert.equal(outputs.workouts_week, 2);
  assert.equal(outputs.last_workout, 'Course 5 km');
  assert.equal(outputs.last_workout_date, '2026-10-22');
  assert.equal(outputs.calories_today, 296);
  assert.equal(
    outputs.sentence,
    "Poids 79,8 kg (-0,7 kg en 7 jours) · 2 séances cette semaine, dernière jeu. 22/10 · 296 kcal aujourd'hui",
  );
});

test('the widget: valid content, within the budget, and its button', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language });
    assert.equal(content.success, true, content.error);
    assert.deepEqual(validateWidgetContent(content.data.content), [], language);
    assert.ok(content.data.content.components.length <= 8);
    assert.ok(content.data.content.components.filter((c) => c.type === 'text').length <= 2);
  }
  const content = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' })).data
    .content;
  assert.deepEqual(
    content.components.map((c) => c.value ?? c.type),
    ['79.8', '-0.7', '2', 'Thu 22/10', '296/2400', 'chart', 'button'],
  );
  const ack = await world.fake.widgetAction(WIDGET_KEY, ACTIONS.REFRESH, {});
  assert.equal(ack.success, true, ack.error);
});

test('wger down, then a refused key: clear statuses, the day counters still grow', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createDevices(world);
  world.wger.down = true;
  world.clock.advance(DAY_MS);
  await world.hub.pollNow();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.equal(world.fake.connectionStatus.message.en, 'wger does not answer');
  assert.equal(stateOf(world, K.DAYS_SINCE_WORKOUT).state, 1);
  assert.equal(world.fake.transports.at(-1).transport, 'unreachable');
  const widget = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' });
  assert.equal(widget.data.content.components.at(-2).text, 'wger does not answer');

  world.wger.down = false;
  await world.fake.configUpdated({ url: BASE, api_key: 'wrong', language: 'en' });
  assert.equal(world.fake.connectionStatus.message.en, 'Access refused: check the API key');
  const ack = await world.fake.sceneAction('get_week_summary', {});
  assert.equal(ack.success, false);
  assert.equal(ack.error, 'Access refused: check the API key');
});

test('without an API key, the configuration says what to do', async (t) => {
  const world = await createWorld({ config: { language: 'de' } });
  t.after(() => world.app.stop());
  assert.equal(world.hub.config.url, 'https://wger.de');
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.de, /API-Schlüssel/);
  assert.deepEqual(world.fake.discoveredDevices, []);
  assert.deepEqual(world.wger.calls, []);
});

test('test the connection: the account, in the four languages', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.fr, 'wger : Connecté en tant que athlete');
});

test('quiet logs: a normal cycle writes nothing at info, no health value, no key', async () => {
  // The SDK logger writes through console.log (debug, info) and console.error.
  const lines = [];
  const { log, error } = console;
  const level = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  let world;
  try {
    world = await createWorld();
    await createDevices(world);
    const startLines = lines.length;
    world.clock.advance(3600_000);
    world.wger.addWeight(79.4, iso(world.clock.now()));
    await world.hub.pollNow();
    await world.fake.sceneAction('add_weight', { weight: '79.3' });
    const cycle = lines.slice(startLines).filter((line) => line.includes('[INFO]'));
    assert.deepEqual(
      cycle.filter((line) => !line.includes('Weigh-in added to wger')),
      [],
      'a reading writes nothing at info',
    );
  } finally {
    console.log = log;
    console.error = error;
    process.env.LOG_LEVEL = level;
    await world?.app.stop();
  }
  const all = lines.join('');
  assert.ok(lines.length > 0, 'the logs were captured');
  for (const secret of [API_KEY, '79.4', '79,4', '79.3', 'athlete@example.org']) {
    assert.ok(!all.includes(secret), `"${secret}" is not in the logs`);
  }
});

test('the trigger state in /data holds no health value', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.clock.advance(3 * DAY_MS);
  await world.hub.pollNow();
  await world.app.stop();
  const saved = readFileSync(join(world.dataDir, 'wger-state.json'), 'utf8');
  assert.ok(!saved.includes('79.8'));
  assert.deepEqual(Object.keys(JSON.parse(saved).state).sort(), [
    'initialized',
    'lastSessionStart',
    'lastWeightDate',
    'noWorkout',
  ]);
});
