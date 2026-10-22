// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake wger, a temporary
// /data and a manual clock, with the integration wired on top through
// registerHandlers. No timer runs unless asked: the tests read wger with
// `world.hub.pollNow()`. (Adapted from guim31/gladys-nightscout.)
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { accountIdOf } from '../../src/config.js';
import { accountIds } from '../../src/devices.js';
import { Store } from '../../src/store.js';
import { API_KEY, BASE, FIXTURE_TIME, FakeWger } from './fakeWger.js';

// The integration logs every change; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

/** A manual clock, shared by the hub and the tests. */
export function createClock(start = FIXTURE_TIME) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export async function createWorld({
  clock = createClock(),
  wger = new FakeWger(),
  config = { url: BASE, api_key: API_KEY, language: 'en' },
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-wger-')),
  timings = {},
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: wger.request,
    timers,
    timings,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, wger, app, hub: app.hub, clock, dataDir };
}

/** External ids of the account device. */
export const idsOf = (world) => accountIds(world.gladys, accountIdOf(BASE, 'athlete'));

/** Add the discovered device in Gladys, as the user would. */
export async function createDevices(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

export { API_KEY, BASE, FIXTURE_TIME, FakeWger };
