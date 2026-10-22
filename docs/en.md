# wger

[wger](https://wger.de) is a free, open-source workout and weight tracker (AGPL-3.0), used on wger.de or self-hosted. This integration brings your wger account into Gladys: your weight and its trend, your workouts of the week, the calories logged today, scene triggers, and a scene action that **adds a weigh-in to wger** — so a connected scale already in Gladys can feed wger.

Tested against a real wger server in Docker (wger 2.8, the version wger.de runs): reading, adding weigh-ins, errors. Not affiliated with the wger project.

## Requirements

- A wger account, on [wger.de](https://wger.de) or on your own server (wger 2.6 or later recommended; tested with 2.8).
- Its **API key**: in wger, open the user menu, then **API key**, and generate a key (on wger.de: <https://wger.de/en/user/api-key>).
- Gladys Assistant 5.1 or later.

## Configuration

In Gladys, open **Integrations → wger**, then the configuration:

- **wger address**: `https://wger.de`, or the address of your own server (e.g. `http://192.168.1.20:8000`). An address copied from the browser is accepted.
- **API key**: the key generated in wger. It is stored by Gladys as a secret and never written in the logs.
- **Refresh interval**: 15 minutes, 30 minutes (default) or 1 hour. A weigh-in added by a scene is read at once.
- **Language of the names**: language of the feature names (frozen when the device is added) and of the texts sent to scenes.

The **Test the connection** button reads wger at once and tells the account it is connected to.

## The device

One device per account, `wger <user name>`, proposed in the **Discovery** tab. Add it to get its features:

| Feature                                             | Value                                                        |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Weight (kg) / Weight (lb)                           | the last weigh-in, in the unit of your wger profile          |
| Change over 7 days (kg) / Change over 7 days (lb)   | the last weigh-in minus the one of 7 days before, or earlier |
| Change over 30 days (kg) / Change over 30 days (lb) | the same over 30 days                                        |
| BMI                                                 | when your height is filled in your wger profile              |
| Days since the last weigh-in                        | 0 the same day                                               |
| Workouts this week                                  | workout sessions since Monday                                |
| Days since the last workout                         | 0 the same day                                               |
| Last workout                                        | its day, then its notes or its routine                       |
| Calories today (kcal)                               | the food logged today, when you have a nutrition plan        |

A change is only given when wger has a weigh-in old enough (no more than twice the period before): with a weigh-in a month ago, there is no "change over 7 days".

Health data: the features keep **no history by default** (you can switch it on per feature in Gladys), and no value is ever written in the logs.

## Widget

The **Weight and workouts** widget shows the weight and its change over 7 days, the workouts of the week, the day of the last workout, the calories of the day (against the goal of the nutrition plan), the weight curve of the last 30 days, and a **Refresh** button. It works even before the device is added.

## Scene triggers

- **New weigh-in**: a weigh-in newer than the last one known appears in wger (app, website, another tool; not the weigh-ins added by the scene action below, which gives its own results). Information passed on: weight, unit, change over 7 days, BMI, date.
- **Workout logged**: a workout session newer than the last one known appears in wger. Information passed on: notes or routine, date, duration, workouts this week.
- **No workout for a while**: no workout for 2, 3, 5, 7 or 14 days (your choice). Once per threshold, until the next workout. Information passed on: days since the last workout, its date.

Triggers are seen at the next reading of wger (see the refresh interval). The first reading of an account announces nothing: only what happens after.

## Scene actions

- **Add a weigh-in**: adds a weight to wger. The weight is a number (`79.8` or `79,8`) or a scene value, for example the weight of a connected scale (insert it with `{{`). The date is now, unless given (`2026-10-22` or `22/10/2026`). Refused, with a line in the Gladys logs: something that is not a number, a weight outside 20–350 kg (44–770 lb), a date in the future and, unless you untick the box, a weight more than 10 % away from the last weigh-in of the past 30 days (someone else, or the cat, on the scale). The same weight on the same day is not added twice. Results: added, weight, unit, date, change over 7 days, message.
- **Read the week summary**: reads wger and gives the weight, its changes, the BMI, the workouts of the week, the last workout, the calories of the day and a ready-made sentence to the next actions.

## Scene examples

- **The scale feeds wger**: trigger "a device value changes" on the weight of your connected scale → action **Add a weigh-in** with that value → a message with the weight and its change over 7 days, given by the action.
- **A nudge on the couch**: trigger **No workout for a while** (3 days) → message "No workout for 3 days, a short run?".
- **Sunday evening summary**: trigger "every Sunday at 20:00" → **Read the week summary** → message with its sentence: "Weight 79.8 kg (-0.7 kg in 7 days) · 2 workouts this week, last one Thu 22/10".

## Troubleshooting

- **Access refused: check the API key**: generate a new key in wger and paste it again (with or without the word "Token").
- **wger does not answer**: check the address, and that Gladys can reach the server (for a self-hosted wger, the port, e.g. `:8000` or `:80`).
- **The address redirects**: give the `https://` address of your server.
- **No calories**: the feature exists only with a nutrition plan in wger; the calories are those of the food logged today.
- **A weigh-in was refused**: the reason is in the Gladys logs (Settings → System → logs of the scene); untick the 10 % check if your weight really changed that much.
- Problems and ideas: <https://github.com/guim31/gladys-wger/issues>.

## Limits

- One wger account per integration. For two people, two wger accounts are needed (and one installation of the integration can follow one of them).
- The weight unit is the one of your wger profile; changing it adds new features in the other unit (update the device from the Discovery tab).
- Read only, except the weigh-ins added by the scene action: no routine, no nutrition plan is changed.
- The calories of the day need one request per food entry the first time (then they are kept): heavy daily logs are read in a few seconds.
- The "Last workout" text gives the notes of the session, or the name of its routine.
