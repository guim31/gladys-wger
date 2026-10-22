// -----------------------------------------------------------------------------
// The Gladys device of the wger account, proposed in the Discovery tab (the
// user adds it, nothing is created on their behalf). One account, one device,
// identified by a digest of the server and the user name (src/config.js):
//
//   weight_kg | weight_lb                 unknown/unknown        last weigh-in
//   weight_change_7d_kg | …_lb            unknown/unknown        change over 7 days
//   weight_change_30d_kg | …_lb           unknown/unknown        change over 30 days
//   bmi                                   unknown/unknown        when wger knows the height
//   days_since_weighing                   duration/integer       days
//   workouts_week                         counter-sensor/integer since Monday
//   days_since_workout                    duration/integer       days
//   last_workout                          text/text              "Mon 20/10 · Legs"
//   calories_today                        unknown/unknown        kcal, with a nutrition plan
//
// The core has neither a weight category nor kg/lb/kcal units: those are
// `unknown` features, their unit in their name and in their key (the unit of
// the wger profile), so a change of unit adds features and never mixes two
// units in one history. A device published again never loses a feature it
// was created with: "Update" in Discovery would drop its history.
//
// Health data: no history by default (each feature can be switched on in
// Gladys), never in the logs. Published with should_poll: false: the
// integration reads wger on its own timer (src/hub.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'account';
export const MODEL = 'wger';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  WEIGHT_KG: 'weight_kg',
  WEIGHT_LB: 'weight_lb',
  CHANGE_7D_KG: 'weight_change_7d_kg',
  CHANGE_7D_LB: 'weight_change_7d_lb',
  CHANGE_30D_KG: 'weight_change_30d_kg',
  CHANGE_30D_LB: 'weight_change_30d_lb',
  BMI: 'bmi',
  DAYS_SINCE_WEIGHING: 'days_since_weighing',
  WORKOUTS_WEEK: 'workouts_week',
  DAYS_SINCE_WORKOUT: 'days_since_workout',
  LAST_WORKOUT: 'last_workout',
  CALORIES_TODAY: 'calories_today',
});

const K = FEATURE_KEYS;

export const weightKeys = (unit) =>
  unit === 'lb'
    ? { weight: K.WEIGHT_LB, change7: K.CHANGE_7D_LB, change30: K.CHANGE_30D_LB }
    : { weight: K.WEIGHT_KG, change7: K.CHANGE_7D_KG, change30: K.CHANGE_30D_KG };

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [K.WEIGHT_KG]: 'Weight (kg)',
    [K.WEIGHT_LB]: 'Weight (lb)',
    [K.CHANGE_7D_KG]: 'Change over 7 days (kg)',
    [K.CHANGE_7D_LB]: 'Change over 7 days (lb)',
    [K.CHANGE_30D_KG]: 'Change over 30 days (kg)',
    [K.CHANGE_30D_LB]: 'Change over 30 days (lb)',
    [K.BMI]: 'BMI',
    [K.DAYS_SINCE_WEIGHING]: 'Days since the last weigh-in',
    [K.WORKOUTS_WEEK]: 'Workouts this week',
    [K.DAYS_SINCE_WORKOUT]: 'Days since the last workout',
    [K.LAST_WORKOUT]: 'Last workout',
    [K.CALORIES_TODAY]: 'Calories today (kcal)',
  },
  fr: {
    [K.WEIGHT_KG]: 'Poids (kg)',
    [K.WEIGHT_LB]: 'Poids (lb)',
    [K.CHANGE_7D_KG]: 'Variation sur 7 jours (kg)',
    [K.CHANGE_7D_LB]: 'Variation sur 7 jours (lb)',
    [K.CHANGE_30D_KG]: 'Variation sur 30 jours (kg)',
    [K.CHANGE_30D_LB]: 'Variation sur 30 jours (lb)',
    [K.BMI]: 'IMC',
    [K.DAYS_SINCE_WEIGHING]: 'Jours depuis la dernière pesée',
    [K.WORKOUTS_WEEK]: 'Séances cette semaine',
    [K.DAYS_SINCE_WORKOUT]: 'Jours depuis la dernière séance',
    [K.LAST_WORKOUT]: 'Dernière séance',
    [K.CALORIES_TODAY]: 'Calories du jour (kcal)',
  },
  de: {
    [K.WEIGHT_KG]: 'Gewicht (kg)',
    [K.WEIGHT_LB]: 'Gewicht (lb)',
    [K.CHANGE_7D_KG]: 'Änderung in 7 Tagen (kg)',
    [K.CHANGE_7D_LB]: 'Änderung in 7 Tagen (lb)',
    [K.CHANGE_30D_KG]: 'Änderung in 30 Tagen (kg)',
    [K.CHANGE_30D_LB]: 'Änderung in 30 Tagen (lb)',
    [K.BMI]: 'BMI',
    [K.DAYS_SINCE_WEIGHING]: 'Tage seit der letzten Wägung',
    [K.WORKOUTS_WEEK]: 'Trainings diese Woche',
    [K.DAYS_SINCE_WORKOUT]: 'Tage seit dem letzten Training',
    [K.LAST_WORKOUT]: 'Letztes Training',
    [K.CALORIES_TODAY]: 'Kalorien heute (kcal)',
  },
  es: {
    [K.WEIGHT_KG]: 'Peso (kg)',
    [K.WEIGHT_LB]: 'Peso (lb)',
    [K.CHANGE_7D_KG]: 'Variación en 7 días (kg)',
    [K.CHANGE_7D_LB]: 'Variación en 7 días (lb)',
    [K.CHANGE_30D_KG]: 'Variación en 30 días (kg)',
    [K.CHANGE_30D_LB]: 'Variación en 30 días (lb)',
    [K.BMI]: 'IMC',
    [K.DAYS_SINCE_WEIGHING]: 'Días desde el último pesaje',
    [K.WORKOUTS_WEEK]: 'Sesiones esta semana',
    [K.DAYS_SINCE_WORKOUT]: 'Días desde la última sesión',
    [K.LAST_WORKOUT]: 'Última sesión',
    [K.CALORIES_TODAY]: 'Calorías de hoy (kcal)',
  },
};

// Display bounds (the core never applies them on write). The changes are
// signed: symmetric bounds.
export const BOUNDS = Object.freeze({
  [K.WEIGHT_KG]: [0, 400],
  [K.WEIGHT_LB]: [0, 900],
  [K.CHANGE_7D_KG]: [-50, 50],
  [K.CHANGE_7D_LB]: [-110, 110],
  [K.CHANGE_30D_KG]: [-100, 100],
  [K.CHANGE_30D_LB]: [-220, 220],
  [K.BMI]: [0, 100],
  [K.DAYS_SINCE_WEIGHING]: [0, 100_000],
  [K.WORKOUTS_WEEK]: [0, 100],
  [K.DAYS_SINCE_WORKOUT]: [0, 100_000],
  [K.CALORIES_TODAY]: [0, 20_000],
});

export const accountIds = (gladys, accountId) => gladys.externalIds(DEVICE_TYPE, accountId);

/** Health data: no history by default (the user may turn it on per feature). */
const feature = (ids, key, language, spec) => ({
  name: (NAMES[language] ?? NAMES.en)[key],
  external_id: ids.feature(key),
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: BOUNDS[key]?.[0] ?? 0,
  max: BOUNDS[key]?.[1] ?? 0,
  ...spec,
});

const number = (ids, key, language) =>
  feature(ids, key, language, { category: C.UNKNOWN, type: T.UNKNOWN.UNKNOWN });

const days = (ids, key, language) =>
  feature(ids, key, language, {
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.DAYS,
  });

/** The features of the created device the blueprint lacks, appended (never fewer). */
export function withCreatedFeatures(device, created) {
  if (!created) {
    return device;
  }
  const known = new Set(device.features.map((f) => f.external_id));
  const extra = (created.features ?? []).filter(
    (f) => f && typeof f.external_id === 'string' && !known.has(f.external_id),
  );
  return extra.length === 0 ? device : { ...device, features: [...device.features, ...extra] };
}

/**
 * The discovery payload of the account.
 * @param {object} gladys
 * @param {object} account { id, username, unit ('kg'|'lb'), hasHeight, hasPlan }
 * @param {string} language of the feature names
 * @param {object} [created] the device as created in Gladys, if it is
 */
export function buildDevice(gladys, account, language = 'en', created = null) {
  const ids = accountIds(gladys, account.id);
  const keys = weightKeys(account.unit);
  const features = [
    number(ids, keys.weight, language),
    number(ids, keys.change7, language),
    number(ids, keys.change30, language),
  ];
  if (account.hasHeight) {
    features.push(number(ids, K.BMI, language));
  }
  features.push(
    days(ids, K.DAYS_SINCE_WEIGHING, language),
    feature(ids, K.WORKOUTS_WEEK, language, {
      category: C.COUNTER_SENSOR,
      type: T.SENSOR.INTEGER,
    }),
    days(ids, K.DAYS_SINCE_WORKOUT, language),
    feature(ids, K.LAST_WORKOUT, language, { category: C.TEXT, type: T.TEXT.TEXT }),
  );
  if (account.hasPlan) {
    features.push(number(ids, K.CALORIES_TODAY, language));
  }
  return withCreatedFeatures(
    {
      name: `wger ${account.username}`.slice(0, 60),
      external_id: ids.device,
      model: MODEL,
      should_poll: false,
      params: [],
      features,
    },
    created,
  );
}

/**
 * The value of every feature that has one now:
 * `{ key, device_feature_external_id, state|text }` (the hub keeps those of
 * the created device).
 * @param {object} view the hub's view (src/hub.js)
 */
export function deviceValues(gladys, accountId, view) {
  const ids = accountIds(gladys, accountId);
  const keys = weightKeys(view.unit);
  const clamp = (key, value) => Math.min(BOUNDS[key][1], Math.max(BOUNDS[key][0], value));
  const values = [];
  const add = (key, value) => {
    if (value !== null && value !== undefined) {
      values.push({ key, state: clamp(key, value) });
    }
  };
  add(keys.weight, view.weight);
  add(keys.change7, view.change7);
  add(keys.change30, view.change30);
  add(K.BMI, view.bmi);
  add(K.DAYS_SINCE_WEIGHING, view.daysSinceWeighing);
  add(K.WORKOUTS_WEEK, view.workoutsWeek);
  add(K.DAYS_SINCE_WORKOUT, view.daysSinceWorkout);
  if (view.lastWorkoutText) {
    values.push({ key: K.LAST_WORKOUT, text: view.lastWorkoutText });
  }
  add(K.CALORIES_TODAY, view.caloriesToday);
  return values.map(({ key, ...value }) => ({
    key,
    device_feature_external_id: ids.feature(key),
    ...value,
  }));
}
