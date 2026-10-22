// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `summary`.
//
// The use case: a glance at the wall tablet tells the weight and its trend,
// how many workouts this week and when the last one was — a nudge to go for a
// run. Tiles (weight, change over 7 days, workouts this week, last workout,
// calories today when a nutrition plan is used), the weight curve of the last
// 30 days, a line when wger cannot be read, a Refresh button.
//
// The figures are sent as values, not bound to device features: the widget
// works before the device is added, and without history in Gladys (health
// data: none by default). The curve is drawn from wger, never stored.
//
// Budget (8 components, 2 texts): five tiles, the chart, one body text when
// needed, the button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './hub.js';
import { DAY_MS, formatDay, formatNumber, formatSigned } from './stats.js';
import { CONNECTION_TEXT, DATA_TEXT, ERROR_TEXT, pick } from './texts.js';

// Action key of the button: permanent once published.
export const ACTIONS = Object.freeze({ REFRESH: 'refresh' });

export const TEXT = {
  weight: { en: 'Weight', fr: 'Poids', de: 'Gewicht', es: 'Peso' },
  change: { en: '7 days', fr: '7 jours', de: '7 Tage', es: '7 días' },
  workouts: { en: 'This week', fr: 'Cette semaine', de: 'Diese Woche', es: 'Esta semana' },
  last: { en: 'Last workout', fr: 'Dernière séance', de: 'Letztes Training', es: 'Última sesión' },
  calories: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  never: { en: 'None', fr: 'Aucune', de: 'Keins', es: 'Ninguna' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refreshed: {
    en: 'wger read again.',
    fr: 'wger relu.',
    de: 'wger neu gelesen.',
    es: 'wger leído de nuevo.',
  },
};

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: pick(text, language) }],
  };
}

async function get(hub, { language = 'en' }) {
  if (!hub.client) {
    return message(hub.config.url ? CONNECTION_TEXT.noKey : CONNECTION_TEXT.invalidUrl, language);
  }
  const view = hub.view();
  const components = [];
  if (view.weight !== null) {
    components.push({
      type: 'value',
      value: formatNumber(view.weight, language),
      unit: view.unit,
      label: pick(TEXT.weight, language),
      icon: 'activity',
      color: WIDGET_COLORS.NEUTRAL,
    });
    if (view.change7 !== null) {
      components.push({
        type: 'value',
        value: formatSigned(view.change7, language),
        unit: view.unit,
        label: pick(TEXT.change, language),
        icon: view.change7 > 0 ? 'trending-up' : 'trending-down',
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
  }
  // Read once at least: a failed first read shows no made-up zero.
  if (hub.profile) {
    components.push({
      type: 'value',
      value: String(view.workoutsWeek ?? 0),
      label: pick(TEXT.workouts, language),
      icon: 'award',
      color: view.workoutsWeek > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    });
    components.push({
      type: 'value',
      value: view.lastWorkout
        ? formatDay(view.lastWorkout.start, language)
        : pick(TEXT.never, language),
      label: pick(TEXT.last, language),
      icon: 'calendar',
      color:
        view.daysSinceWorkout !== null && view.daysSinceWorkout >= 7
          ? WIDGET_COLORS.WARNING
          : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (view.caloriesToday !== null) {
    components.push({
      type: 'value',
      value: view.goalEnergy
        ? `${view.caloriesToday}/${view.goalEnergy}`
        : String(view.caloriesToday),
      unit: 'kcal',
      label: pick(TEXT.calories, language),
      icon: 'coffee',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  const since = (view.weightDate ?? 0) - 30 * DAY_MS;
  const points = hub.weights
    .filter((entry) => entry.date >= since)
    .reverse()
    .map((entry) => ({ t: new Date(entry.date).toISOString(), v: entry.weight }));
  if (points.length > 1) {
    components.push({
      type: 'chart',
      chart_type: 'line',
      unit: view.unit,
      series: [{ name: pick(TEXT.weight, language), points }],
    });
  }
  let body = null;
  if (hub.error) {
    body = ERROR_TEXT[hub.error.kind];
  } else if (hub.profile && view.weight === null) {
    body = DATA_TEXT.noWeight;
  }
  if (body) {
    components.push({ type: 'text', variant: 'body', text: pick(body, language) });
  }
  components.push({
    type: 'button',
    label: pick(TEXT.refresh, language),
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: ACTIONS.REFRESH },
  });
  return { ttl_seconds: 600, components };
}

async function action(hub, { actionKey }) {
  if (actionKey !== ACTIONS.REFRESH) {
    throw new Error(`Unknown action ${actionKey}`);
  }
  await hub.pollNow();
  if (hub.error) {
    return { message: ERROR_TEXT[hub.error.kind] };
  }
  return { message: TEXT.refreshed };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
