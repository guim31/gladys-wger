// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// `add_weight`: a connected scale integrated in Gladys feeds wger. The weight
// comes from a scene variable ("{{…}}" of a "Get device value" step or of the
// scale's trigger), the date is today unless given. Refused, with a message
// in the Gladys logs: what is not a number, a weight outside 20–350 kg
// (44–770 lb), and by default a weight more than 10 % away from the last
// weigh-in of the past 30 days (someone else, a child, the cat on the scale).
// The same weight on the same day is not added twice (a scene run twice).
//
// `get_week_summary`: the figures of the week and a sentence, for a message
// or a spoken announcement.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  DAY_MS,
  WEIGHT_LIMITS,
  formatDay,
  formatNumber,
  formatSigned,
  isoDay,
  parseDay,
  parseWeight,
  startOfDay,
} from './stats.js';
import { DATA_TEXT, SUMMARY_TEXT, WEIGHT_TEXT, pick } from './texts.js';

const logger = createLogger({ name: 'wger-scenes' });

// Largest change accepted from the last weigh-in of the past 30 days.
export const MAX_CHANGE = 0.1;

async function readable(hub) {
  if (!hub.client) {
    hub.assertReadable();
  }
  await hub.refreshIfStale();
  hub.assertReadable();
}

/** "79,8 kg" in the language. */
const weightText = (weight, unit, language) => `${formatNumber(weight, language)} ${unit}`;

export function summarySentence(hub, language) {
  const view = hub.view();
  const text = SUMMARY_TEXT[language] ?? SUMMARY_TEXT.en;
  const parts = [
    view.weight === null
      ? text.noWeight
      : text.weight(
          weightText(view.weight, view.unit, language),
          view.change7 === null ? null : `${formatSigned(view.change7, language)} ${view.unit}`,
        ),
    [
      text.workouts(view.workoutsWeek ?? 0),
      view.lastWorkout ? text.last(formatDay(view.lastWorkout.start, language)) : null,
    ]
      .filter(Boolean)
      .join(', '),
  ];
  if (view.caloriesToday !== null) {
    parts.push(text.calories(view.caloriesToday));
  }
  return parts.join(' · ');
}

export const SCENE_ACTIONS = {
  async add_weight(hub, { fields = {} }) {
    const language = hub.config.language;
    const fail = (text) => {
      throw new Error(pick(text, language));
    };
    await readable(hub);
    const unit = hub.unit;
    const weight = parseWeight(fields.weight);
    if (weight === null) {
      fail(WEIGHT_TEXT.notNumber);
    }
    const [min, max] = WEIGHT_LIMITS[unit];
    if (weight < min || weight > max) {
      fail(WEIGHT_TEXT.outOfRange);
    }
    const now = hub.now();
    const date = parseDay(fields.date, now);
    if (date === null) {
      fail(WEIGHT_TEXT.badDate);
    }
    if (date > now + 3600_000) {
      fail(WEIGHT_TEXT.future);
    }
    const recent = hub.weights.find(
      (entry) => entry.date <= date && entry.date >= date - 30 * DAY_MS,
    );
    if (
      fields.check_change !== false &&
      recent &&
      Math.abs(weight - recent.weight) > recent.weight * MAX_CHANGE
    ) {
      fail(WEIGHT_TEXT.tooFar);
    }
    const duplicate = hub.weights.some(
      (entry) => entry.weight === weight && startOfDay(entry.date) === startOfDay(date),
    );
    if (!duplicate) {
      await hub.client.addWeight(weight, date);
      // One line per action of the user, without the value (health data).
      logger.info('Weigh-in added to wger');
      await hub.pollNow();
    }
    const view = hub.view();
    return {
      added: !duplicate,
      weight,
      unit,
      date: isoDay(date),
      change_7d: view.change7 ?? 0,
      message: pick(duplicate ? WEIGHT_TEXT.duplicate : WEIGHT_TEXT.added, language),
    };
  },

  async get_week_summary(hub) {
    await readable(hub);
    const language = hub.config.language;
    const view = hub.view();
    if (view.weight === null && !view.lastWorkout) {
      logger.debug('Week summary without data');
    }
    return {
      weight: view.weight ?? 0,
      unit: view.unit,
      weight_change_7d: view.change7 ?? 0,
      weight_change_30d: view.change30 ?? 0,
      bmi: view.bmi ?? 0,
      days_since_weighing: view.daysSinceWeighing ?? 0,
      workouts_week: view.workoutsWeek ?? 0,
      days_since_workout: view.daysSinceWorkout ?? 0,
      last_workout_date: view.lastWorkout ? isoDay(view.lastWorkout.start) : '',
      last_workout: view.lastWorkout ? hub.workoutLabel(view.lastWorkout) : '',
      calories_today: view.caloriesToday ?? 0,
      sentence:
        view.weight === null && !view.lastWorkout
          ? pick(DATA_TEXT.noWeight, language)
          : summarySentence(hub, language),
    };
  },
};
