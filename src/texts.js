// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene outputs
// and errors. Four languages, the four of the Gladys interface; German says
// "du", Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './wger/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noKey: {
    en: 'Enter the API key of your wger account in the configuration.',
    fr: 'Saisissez la clé API de votre compte wger dans la configuration.',
    de: 'Gib den API-Schlüssel deines wger-Kontos in der Konfiguration ein.',
    es: 'Introduzca la clave API de su cuenta wger en la configuración.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. https://wger.de',
    fr: 'Adresse incomprise, ex. https://wger.de',
    de: 'Adresse nicht verstanden, z. B. https://wger.de',
    es: 'Dirección no válida, p. ej. https://wger.de',
  },
};

// One short explanation per error kind (src/wger/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'wger does not answer',
    fr: 'wger ne répond pas',
    de: 'wger antwortet nicht',
    es: 'wger no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'Certificate refused: use a trusted certificate or an http:// address',
    fr: 'Certificat refusé : utilisez un certificat reconnu ou une adresse http://',
    de: 'Zertifikat abgelehnt: Nutze ein vertrauenswürdiges Zertifikat oder eine http://-Adresse',
    es: 'Certificado rechazado: use un certificado reconocido o una dirección http://',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'Access refused: check the API key',
    fr: 'Accès refusé : vérifiez la clé API',
    de: 'Zugriff verweigert: Prüfe den API-Schlüssel',
    es: 'Acceso denegado: compruebe la clave API',
  },
  [ERROR_KINDS.NOT_WGER]: {
    en: 'No wger API at this address',
    fr: 'Aucune API wger à cette adresse',
    de: 'Keine wger-API unter dieser Adresse',
    es: 'No hay ninguna API de wger en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'The address redirects: enter the https:// address',
    fr: "L'adresse redirige : saisissez l'adresse en https://",
    de: 'Die Adresse leitet um: Gib die https://-Adresse ein',
    es: 'La dirección redirige: introduzca la dirección https://',
  },
  [ERROR_KINDS.RATE_LIMITED]: {
    en: 'wger asks to slow down: choose a longer refresh interval',
    fr: 'wger demande de ralentir : choisissez un intervalle plus long',
    de: 'wger bittet um weniger Anfragen: Wähle ein längeres Intervall',
    es: 'wger pide ir más despacio: elija un intervalo más largo',
  },
  [ERROR_KINDS.SERVER]: {
    en: 'wger answers with an error: try again later',
    fr: 'wger répond en erreur : réessayez plus tard',
    de: 'wger antwortet mit einem Fehler: Versuche es später erneut',
    es: 'wger responde con un error: inténtelo más tarde',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'Unexpected answer, see the logs',
    fr: 'Réponse inattendue, voir les logs',
    de: 'Unerwartete Antwort, sieh in den Protokollen nach',
    es: 'Respuesta inesperada, consulte los registros',
  },
};

export const DATA_TEXT = {
  noWeight: {
    en: 'No weigh-in in wger yet.',
    fr: 'Aucune pesée dans wger pour le moment.',
    de: 'Noch keine Wägung in wger.',
    es: 'Todavía no hay ningún pesaje en wger.',
  },
};

// Refusals of the "Add a weigh-in" scene action (thrown: logged by Gladys).
export const WEIGHT_TEXT = {
  notNumber: {
    en: 'Weight not understood: give a number, e.g. 79.8',
    fr: 'Poids incompris : donnez un nombre, ex. 79,8',
    de: 'Gewicht nicht verstanden: Gib eine Zahl an, z. B. 79,8',
    es: 'Peso no válido: indique un número, p. ej. 79,8',
  },
  outOfRange: {
    en: 'Weight refused: outside the plausible range',
    fr: 'Poids refusé : hors des valeurs plausibles',
    de: 'Gewicht abgelehnt: außerhalb plausibler Werte',
    es: 'Peso rechazado: fuera de los valores plausibles',
  },
  tooFar: {
    en: 'Weight refused: more than 10 % away from the last weigh-in',
    fr: 'Poids refusé : plus de 10 % d’écart avec la dernière pesée',
    de: 'Gewicht abgelehnt: mehr als 10 % Abweichung zur letzten Wägung',
    es: 'Peso rechazado: más de un 10 % de diferencia con el último pesaje',
  },
  badDate: {
    en: 'Date not understood: e.g. 2026-10-22, or empty for today',
    fr: "Date incomprise : ex. 2026-10-22, ou vide pour aujourd'hui",
    de: 'Datum nicht verstanden: z. B. 2026-10-22, oder leer für heute',
    es: 'Fecha no válida: p. ej. 2026-10-22, o vacía para hoy',
  },
  future: {
    en: 'Date refused: it is in the future',
    fr: 'Date refusée : elle est dans le futur',
    de: 'Datum abgelehnt: Es liegt in der Zukunft',
    es: 'Fecha rechazada: está en el futuro',
  },
  added: {
    en: 'Weigh-in added to wger',
    fr: 'Pesée ajoutée dans wger',
    de: 'Wägung in wger hinzugefügt',
    es: 'Pesaje añadido en wger',
  },
  duplicate: {
    en: 'Same weigh-in already in wger for that day',
    fr: 'Même pesée déjà dans wger pour ce jour',
    de: 'Gleiche Wägung für diesen Tag schon in wger',
    es: 'El mismo pesaje ya está en wger para ese día',
  },
};

// The `sentence` of "Read the week summary", e.g. for a message on Sunday.
export const SUMMARY_TEXT = {
  en: {
    weight: (weight, change) => `Weight ${weight}${change ? ` (${change} in 7 days)` : ''}`,
    noWeight: 'No weigh-in',
    workouts: (count) => `${count} workout${count === 1 ? '' : 's'} this week`,
    last: (day) => `last one ${day}`,
    calories: (kcal) => `${kcal} kcal today`,
  },
  fr: {
    weight: (weight, change) => `Poids ${weight}${change ? ` (${change} en 7 jours)` : ''}`,
    noWeight: 'Aucune pesée',
    workouts: (count) => `${count} séance${count > 1 ? 's' : ''} cette semaine`,
    last: (day) => `dernière ${day}`,
    calories: (kcal) => `${kcal} kcal aujourd'hui`,
  },
  de: {
    weight: (weight, change) => `Gewicht ${weight}${change ? ` (${change} in 7 Tagen)` : ''}`,
    noWeight: 'Keine Wägung',
    workouts: (count) => `${count} Training${count === 1 ? '' : 's'} diese Woche`,
    last: (day) => `zuletzt ${day}`,
    calories: (kcal) => `${kcal} kcal heute`,
  },
  es: {
    weight: (weight, change) => `Peso ${weight}${change ? ` (${change} en 7 días)` : ''}`,
    noWeight: 'Ningún pesaje',
    workouts: (count) => `${count} sesi${count === 1 ? 'ón' : 'ones'} esta semana`,
    last: (day) => `la última ${day}`,
    calories: (kcal) => `${kcal} kcal hoy`,
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: { ok: (user) => `Connected as ${user}` },
  fr: { ok: (user) => `Connecté en tant que ${user}` },
  de: { ok: (user) => `Verbunden als ${user}` },
  es: { ok: (user) => `Conectado como ${user}` },
};

export const LANGUAGE_FALLBACK = 'en';

/** "Name: text", with the space French puts before a colon. */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;
export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];
