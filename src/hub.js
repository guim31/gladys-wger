// -----------------------------------------------------------------------------
// The wger hub: the account read on a timer of the container (every 15 to 60
// minutes, as configured); the states of the device published when they
// change, the scene events, and the views the widget and the scene actions
// read.
//
// Gladys never polls the device (should_poll: false): the timer of the
// container reads wger whether the device was added or not, so the scene
// triggers work either way (Gladys 5.2.0 never polls a device created without
// should_poll, GladysAssistant/Gladys#3198).
//
// One reading: the profile (user name, height, unit), the last weigh-ins, the
// last workout sessions, the nutrition plans and, when there is one, the food
// logged today (the energy of each entry is read once, then cached). A
// failure of the nutrition part costs only the calories. The trigger state
// (ids and dates, no health value) is kept in /data (src/store.js).
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { accountIdOf, hostOf, isPrivateHost, normalizeConfig } from './config.js';
import { accountIds, buildDevice, deviceValues } from './devices.js';
import { ProblemLog } from './problems.js';
import {
  bmiOf,
  daysBetween,
  formatDay,
  isoDay,
  nextDay,
  startOfDay,
  weightChange,
  workoutsThisWeek,
} from './stats.js';
import { CONNECTION_TEXT, ERROR_TEXT, REPORT_TEXT, labelled, pick } from './texts.js';
import { ERROR_KINDS, WgerClient, WgerError } from './wger/client.js';

const logger = createLogger({ name: 'wger-hub' });

export const WIDGET_KEY = 'summary';

// Keys of the scene triggers: permanent once published.
export const TRIGGERS = Object.freeze({
  WEIGHT_ADDED: 'weight_added',
  WORKOUT_LOGGED: 'workout_logged',
  NO_WORKOUT: 'no_workout',
});

// "No workout for N days": the thresholds offered, each announced once per
// silence (the `days` filter of the trigger).
export const NO_WORKOUT_DAYS = ['2', '3', '5', '7', '14'];

export const HUB_TIMINGS = {
  // An unchanged value is sent again this often: Gladys shows "no recent
  // value" after 48 hours.
  heartbeatMs: 12 * 3600_000,
  // A scene action reads wger again when the last read is older.
  freshMs: 60_000,
};

const emptyState = () => ({
  initialized: false,
  lastWeightDate: null,
  lastSessionStart: null,
  noWorkout: [],
});

function loadState(raw) {
  const state = emptyState();
  if (raw && typeof raw === 'object') {
    state.initialized = raw.initialized === true;
    if (Number.isFinite(raw.lastWeightDate)) {
      state.lastWeightDate = raw.lastWeightDate;
    }
    if (Number.isFinite(raw.lastSessionStart)) {
      state.lastSessionStart = raw.lastSessionStart;
    }
    if (Array.isArray(raw.noWorkout)) {
      state.noWorkout = raw.noWorkout.filter((days) => NO_WORKOUT_DAYS.includes(days));
    }
  }
  return state;
}

export class WgerHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/wger/client.js)
   * @param {boolean} [options.timers] the reading timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = normalizeConfig({});
    this.client = null;
    this.signature = null;
    this.resetData();
    this.saved = { account: null, state: emptyState() };
    this.transports = new Map();
    this.connection = null;
    this.discovered = null;
    this.pollTimer = null;
    this.stopped = false;
    this.problems = new ProblemLog(logger);
  }

  resetData() {
    this.profile = null;
    this.accountId = null;
    /** @type {{ id: string, date: number, weight: number }[]} newest first */
    this.weights = [];
    /** @type {{ id: string, start: number, end: number|null, notes: string, routine: number|null }[]} */
    this.sessions = [];
    this.lastRoutine = '';
    this.plans = [];
    this.calories = null;
    /** @type {Map<string, number>} energy of the diary entries of today, by entry key */
    this.energies = new Map();
    this.readAt = 0;
    this.error = null;
    this.polling = null;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    this.saved = {
      account: typeof saved.account === 'string' ? saved.account : null,
      state: loadState(saved.state),
    };
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.transports.clear();
    this.connection = null;
    this.discovered = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const signature = JSON.stringify([config.url, config.apiKey]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.client =
        config.url && config.apiKey
          ? new WgerClient({ url: config.url, apiKey: config.apiKey, request: this.request })
          : null;
      this.resetData();
    }
    if (previous.language !== config.language) {
      this.discovered = null; // new names for the Discovery tab
    }
    try {
      if (this.client) {
        await this.pollNow({ publish: true });
      } else {
        await this.afterChanges(true, { publish: true });
      }
    } finally {
      this.schedulePoll();
    }
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    await this.store.flush();
  }

  /** The next read by the timer, after `delayMs` (the refresh interval by default). */
  schedulePoll(delayMs = this.config.pollIntervalMs) {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollNow();
        this.problems.recover('poll', 'Reading wger works again');
      } catch (err) {
        this.problems.fail('poll', `Poll failed: ${err.message}`, 'error');
      }
      this.schedulePoll();
    }, delayMs);
  }

  // --- Reading wger ----------------------------------------------------------

  /** Read the account now and publish what changed. */
  async pollNow({ publish = false } = {}) {
    const changed = await this.poll();
    await this.afterChanges(changed, { publish });
  }

  /** Read again when the last read is older than `freshMs` (scene actions). */
  async refreshIfStale() {
    if (this.client && (this.error || this.now() - this.readAt >= this.timings.freshMs)) {
      await this.pollNow();
    }
  }

  /**
   * Read the account and apply what changed. Concurrent calls share the read.
   * @returns {Promise<boolean>} whether the widget shows something new
   */
  poll() {
    if (!this.client) {
      return Promise.resolve(false);
    }
    if (!this.polling) {
      const polling = this.read(this.client).finally(() => {
        if (this.polling === polling) {
          this.polling = null;
        }
      });
      this.polling = polling;
    }
    return this.polling;
  }

  async read(client) {
    let data;
    try {
      const profile = await client.profile();
      const weights = await client.weights();
      const sessions = await client.sessions();
      const routine = sessions[0]?.routine ?? null;
      const lastRoutine = routine === null ? '' : await client.routineName(routine);
      data = { profile, weights, sessions, lastRoutine };
    } catch (err) {
      if (!(err instanceof WgerError)) {
        throw err;
      }
      return client === this.client && this.applyFailure(err);
    }
    // Optional: an account without nutrition plan has no calories.
    let { plans, calories } = this;
    try {
      plans = await client.plans();
      calories = plans.length > 0 ? await this.readCalories(client) : null;
      this.problems.recover('nutrition', 'Nutrition read again');
    } catch (err) {
      if (!(err instanceof WgerError)) {
        throw err;
      }
      this.problems.fail('nutrition', `Nutrition not read: ${err.message}`, 'debug');
    }
    if (client !== this.client) {
      return false;
    }
    return this.applySuccess({ ...data, plans, calories });
  }

  /** The energy logged today (kcal): one request per new or edited entry. */
  async readCalories(client) {
    const now = this.now();
    const entries = await client.diary(startOfDay(now), nextDay(now));
    const energies = new Map();
    for (const entry of entries) {
      energies.set(entry.key, this.energies.get(entry.key) ?? (await client.diaryEnergy(entry.id)));
    }
    this.energies = energies;
    return Math.round([...energies.values()].reduce((sum, energy) => sum + energy, 0));
  }

  async applySuccess({ profile, weights, sessions, lastRoutine, plans, calories }) {
    const before = JSON.stringify(this.view());
    if (this.error) {
      logger.info('wger answers again');
    }
    if (this.readAt === 0) {
      logger.info(`wger (${hostOf(this.config.url)}): account read`);
    }
    const hadError = this.error !== null;
    this.error = null;
    this.readAt = this.now();
    this.profile = profile;
    this.accountId = accountIdOf(this.config.url, profile.username);
    this.weights = weights;
    this.sessions = sessions;
    this.lastRoutine = lastRoutine;
    this.plans = plans;
    this.calories = calories;
    if (this.saved.account !== this.accountId) {
      // Another account: the trigger state of the previous one means nothing.
      this.saved = { account: this.accountId, state: emptyState() };
      this.store.save(this.saved);
    }
    await this.runTriggers();
    await this.publishStates();
    return hadError || before !== JSON.stringify(this.view());
  }

  async applyFailure(err) {
    const wasError = this.error?.kind;
    this.error = { kind: err.kind, message: err.message };
    this.readAt = this.now();
    if (wasError !== err.kind) {
      logger.warn(`wger: ${err.message}`);
    }
    // The days since the last workout still grow: "no workout" still counts.
    await this.runTriggers();
    await this.publishStates();
    return wasError !== err.kind;
  }

  // --- Views -----------------------------------------------------------------

  get unit() {
    return this.profile?.unit ?? 'kg';
  }

  /** Everything the device, the widget and the scene actions show. */
  view() {
    const now = this.now();
    const latest = this.weights[0] ?? null;
    const session = this.sessions[0] ?? null;
    return {
      unit: this.unit,
      weight: latest?.weight ?? null,
      weightDate: latest?.date ?? null,
      change7: weightChange(this.weights, 7),
      change30: weightChange(this.weights, 30),
      bmi: latest ? bmiOf(latest.weight, this.unit, this.profile?.heightCm) : null,
      daysSinceWeighing: latest ? daysBetween(latest.date, now) : null,
      workoutsWeek: this.readAt ? workoutsThisWeek(this.sessions, now) : null,
      lastWorkout: session,
      daysSinceWorkout: session ? daysBetween(session.start, now) : null,
      lastWorkoutText: session ? this.workoutText(session, this.config.language) : null,
      caloriesToday: this.calories,
      goalEnergy: this.plans[0]?.goalEnergy ?? null,
    };
  }

  /** "Mon 20/10 · Legs, good shape": the day, then the notes or the routine. */
  workoutText(session, language) {
    const what = this.workoutLabel(session);
    return `${formatDay(session.start, language)}${what ? ` · ${what}` : ''}`.slice(0, 120);
  }

  workoutLabel(session) {
    const routine = session === this.sessions[0] ? this.lastRoutine : '';
    return session.notes || routine || '';
  }

  // --- Scene events ------------------------------------------------------------

  deviceName() {
    return this.profile ? `wger ${this.profile.username}`.slice(0, 60) : 'wger';
  }

  /**
   * The events since the last reading: a newer weigh-in, a newer workout,
   * a threshold of days without workout crossed. The first reading of an
   * account only sets the state.
   */
  async runTriggers() {
    if (!this.accountId) {
      return;
    }
    const state = structuredClone(this.saved.state);
    const events = [];
    const now = this.now();
    if (!this.error) {
      // The first reading of an account only sets the state.
      const first = !state.initialized;
      state.initialized = true;
      const latest = this.weights[0];
      if (latest && (state.lastWeightDate === null || latest.date > state.lastWeightDate)) {
        if (!first) {
          events.push([TRIGGERS.WEIGHT_ADDED, this.weightData()]);
        }
        state.lastWeightDate = latest.date;
      }
      const session = this.sessions[0];
      if (session && (state.lastSessionStart === null || session.start > state.lastSessionStart)) {
        if (!first) {
          events.push([TRIGGERS.WORKOUT_LOGGED, this.workoutData(session)]);
        }
        state.lastSessionStart = session.start;
        // A new silence starts; on a first reading, the thresholds already
        // passed are not announced.
        state.noWorkout = first ? this.passedThresholds(session.start, now) : [];
      }
    }
    if (state.lastSessionStart !== null) {
      const days = daysBetween(state.lastSessionStart, now);
      for (const threshold of NO_WORKOUT_DAYS) {
        if (days >= Number(threshold) && !state.noWorkout.includes(threshold)) {
          state.noWorkout.push(threshold);
          events.push([
            TRIGGERS.NO_WORKOUT,
            {
              days: threshold,
              device_name: this.deviceName(),
              days_since_workout: days,
              last_workout_date: isoDay(state.lastSessionStart),
            },
          ]);
        }
      }
    }
    if (JSON.stringify(state) !== JSON.stringify(this.saved.state)) {
      this.saved = { account: this.accountId, state };
      // Written on a change only: no wear of the SD card at every read.
      this.store.save(this.saved);
    }
    for (const [key, data] of events) {
      await this.fire(key, data);
    }
  }

  passedThresholds(start, now) {
    const days = daysBetween(start, now);
    return NO_WORKOUT_DAYS.filter((threshold) => days >= Number(threshold));
  }

  weightData() {
    const view = this.view();
    return {
      device_name: this.deviceName(),
      weight: view.weight,
      unit: view.unit,
      change_7d: view.change7 ?? 0,
      bmi: view.bmi ?? 0,
      date: isoDay(view.weightDate),
    };
  }

  workoutData(session) {
    return {
      device_name: this.deviceName(),
      notes: this.workoutLabel(session),
      date: isoDay(session.start),
      duration_minutes:
        session.end && session.end > session.start
          ? Math.round((session.end - session.start) / 60_000)
          : 0,
      workouts_week: workoutsThisWeek(this.sessions, this.now()),
    };
  }

  async fire(key, data) {
    // Debug only, without the values: health data is not for the logs.
    logger.debug(`Scene event ${key}`);
    try {
      await this.gladys.publishSceneEvent(key, {
        device: accountIds(this.gladys, this.accountId).device,
        ...data,
      });
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys ----------------------------------------------------

  createdDevice() {
    if (!this.accountId) {
      return null;
    }
    const externalId = accountIds(this.gladys, this.accountId).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === externalId) ?? null;
  }

  discoveredDevices() {
    if (!this.client || this.error || !this.profile) {
      return null; // nothing read: keep the list Gladys has
    }
    return [
      buildDevice(
        this.gladys,
        {
          id: this.accountId,
          username: this.profile.username,
          unit: this.unit,
          hasHeight: this.profile.heightCm !== null,
          hasPlan: this.plans.length > 0,
        },
        this.config.language,
        this.createdDevice(),
      ),
    ];
  }

  /** Publish the Discovery list when it changed (the unit, a plan…). */
  async publishDevices({ force = false } = {}) {
    const devices = this.discoveredDevices() ?? (this.client ? null : []);
    if (devices === null) {
      return;
    }
    const key = JSON.stringify(devices);
    if (!force && key === this.discovered) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discovered = key;
      this.problems.recover('discovered', 'Discovered devices accepted again');
    } catch (err) {
      this.problems.fail('discovered', `Discovered devices refused: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab: read wger, publish the list again. */
  async rediscover() {
    await this.poll();
    await this.afterChanges(true, { publish: true });
  }

  /**
   * The user added (or updated) the device: its states sent before were
   * dropped by Gladys, and a device deleted then added again needs its badge.
   */
  async onDeviceCreated(device) {
    this.transports.delete(device.external_id);
    this.discovered = null;
    await this.publishStates();
    await this.publishTransports();
    await this.publishDevices();
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** Gladys asks for a refresh (onPoll, only if it polls anyway). */
  async pollDevice() {
    await this.pollNow();
  }

  /**
   * The states of the created device, its own features only (a state for a
   * feature it lacks is dropped by Gladys with a log line). The SDK skips the
   * values Gladys already has, and sends an unchanged one after `heartbeatMs`.
   * wger down: only the day counters, which still grow.
   */
  async publishStates() {
    const created = this.createdDevice();
    if (!created || !this.profile) {
      return;
    }
    const own = new Set((created.features ?? []).map((feature) => feature.external_id));
    const kept = this.error ? new Set(['days_since_weighing', 'days_since_workout']) : null;
    const states = deviceValues(this.gladys, this.accountId, this.view())
      .filter((value) => own.has(value.device_feature_external_id))
      .filter((value) => !kept || kept.has(value.key))
      .map(({ key: _key, ...state }) => state);
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.problems.recover('states', 'States accepted again');
    } catch (err) {
      this.problems.fail('states', `States refused: ${err.message}`);
    }
  }

  async afterChanges(widgetChanged, { publish = false } = {}) {
    await this.publishDevices({ force: publish });
    await this.publishTransports();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  /** The badge of the device: local or cloud by the address, or unreachable. */
  async publishTransports() {
    const created = this.createdDevice();
    if (!this.client || this.readAt === 0 || !created) {
      return;
    }
    let transport = DEVICE_TRANSPORTS.UNREACHABLE;
    if (!this.error) {
      transport = isPrivateHost(new URL(this.config.url).hostname)
        ? DEVICE_TRANSPORTS.LOCAL
        : DEVICE_TRANSPORTS.CLOUD;
    }
    if (this.transports.get(created.external_id) === transport) {
      return;
    }
    try {
      await this.gladys.publishTransports([{ external_id: created.external_id, transport }]);
      this.transports.set(created.external_id, transport);
      this.problems.recover('transports', 'Transports accepted again');
    } catch (err) {
      this.problems.fail('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.config.url) {
      return { connected: false, message: CONNECTION_TEXT.invalidUrl };
    }
    if (!this.config.apiKey) {
      return { connected: false, message: CONNECTION_TEXT.noKey };
    }
    if (this.error) {
      return { connected: false, message: ERROR_TEXT[this.error.kind] };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.problems.recover('connection', 'Connection status accepted again');
    } catch (err) {
      this.problems.fail('connection', `Connection status refused: ${err.message}`);
    }
  }

  // --- Commands ----------------------------------------------------------------

  /** Throws the reason wger cannot answer, if any. */
  assertReadable() {
    const status = this.connectionStatus();
    if (!status.connected) {
      throw new Error(pick(status.message, this.config.language));
    }
  }

  /** "Test the connection": read wger now, one line per language. */
  async testConnection() {
    await this.pollNow({ publish: true });
    const status = this.connectionStatus();
    const message = {};
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      message[language] =
        status.connected && this.profile
          ? labelled('wger', text.ok(this.profile.username), language)
          : pick(status.message ?? ERROR_TEXT[ERROR_KINDS.HTTP], language);
    }
    return message;
  }
}

export { ERROR_KINDS };
