// -----------------------------------------------------------------------------
// What the integration computes from the wger data: the weight changes, the
// BMI, the workouts of the week, the days since a date. Pure functions, in the
// local time of Gladys (the supervisor injects TZ).
// -----------------------------------------------------------------------------

export const DAY_MS = 86_400_000;
const LB_IN_KG = 0.45359237;

export const round1 = (value) => {
  const rounded = Math.round(value * 10) / 10;
  // -0 would be published as a change of sign.
  return rounded === 0 ? 0 : rounded;
};

/** Local midnight of the day of `time`. */
export function startOfDay(time) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Local midnight of the Monday of the week of `time` (ISO week). */
export function startOfWeek(time) {
  const date = new Date(startOfDay(time));
  const sinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday).getTime();
}

/** Local midnight of the next day. */
export function nextDay(time) {
  const date = new Date(startOfDay(time));
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/** Calendar days from `from` to `to` (0 the same day), whatever the DST. */
export const daysBetween = (from, to) =>
  Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS));

/**
 * The change of weight over `days`: the newest weigh-in minus the newest one
 * of the day `days` before it, or earlier (calendar days: Thursday morning
 * against last Thursday evening is a week). Null when there is none, or when
 * that one is older than twice `days` (a weigh-in a month ago tells nothing
 * of a week).
 * @param {{ date: number, weight: number }[]} weights newest first
 */
export function weightChange(weights, days) {
  const latest = weights[0];
  if (!latest) {
    return null;
  }
  const limit = nextDay(latest.date - days * DAY_MS);
  const baseline = weights.find((entry) => entry.date < limit);
  if (!baseline || baseline.date < latest.date - 2 * days * DAY_MS) {
    return null;
  }
  return round1(latest.weight - baseline.weight);
}

/** The BMI of a weight in the unit of the profile, null without height. */
export function bmiOf(weight, unit, heightCm) {
  if (!heightCm || !(weight > 0)) {
    return null;
  }
  const kg = unit === 'lb' ? weight * LB_IN_KG : weight;
  const meters = heightCm / 100;
  return round1(kg / (meters * meters));
}

/** The sessions started this week (from Monday), up to now. */
export const workoutsThisWeek = (sessions, now) => {
  const monday = startOfWeek(now);
  return sessions.filter((session) => session.start >= monday && session.start <= now).length;
};

// Weights a scale or a person may give; wger itself refuses outside 20–350 kg.
export const WEIGHT_LIMITS = Object.freeze({ kg: [20, 350], lb: [44, 770] });

/**
 * A weight typed or passed by a scene: "79,8", "79.8 kg", 79.8.
 * @returns {number|null} rounded to 0.01, null when not a number
 */
export function parseWeight(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s*(kg|lbs?)$/i, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Math.round(Number(text) * 100) / 100;
}

/**
 * A date typed or passed by a scene: "2026-10-22", "22/10/2026", or empty for
 * now. A day only is taken at noon (local), so the weigh-in stays on that day
 * whatever the time zone of the wger server.
 * @returns {number|null} ms, null when not understood
 */
export function parseDay(raw, now) {
  const text = String(raw ?? '').trim();
  if (!text) {
    return now;
  }
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let parts = match ? [match[1], match[2], match[3]] : null;
  match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (match) {
    parts = [match[3], match[2], match[1]];
  }
  if (!parts) {
    return null;
  }
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "79,8" in French, German and Spanish, "79.8" in English. */
export const formatNumber = (value, language, digits = 1) =>
  new Intl.NumberFormat(LOCALES[language] ?? 'en-GB', {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);

/** "+0,4", "-1,2", "0". */
export const formatSigned = (value, language) =>
  `${value > 0 ? '+' : ''}${formatNumber(value, language)}`;

/** "Mon 20/10" in the language, local time. */
export const formatDay = (time, language) =>
  new Intl.DateTimeFormat(LOCALES[language] ?? 'en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(time));

/** "2026-10-20", local time: the variables of the scenes. */
export const isoDay = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
