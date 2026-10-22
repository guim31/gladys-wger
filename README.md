# wger for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that reads a [wger](https://wger.de) account, the free and open-source workout
and weight tracker, on wger.de or self-hosted.

- **One device per account**: last weight, its change over 7 and 30 days, BMI
  (when wger knows the height), days since the last weigh-in, workouts this
  week, days since the last workout, the last workout (day, notes or routine),
  and the calories logged today when a nutrition plan is used. Health data: no
  history by default, never in the logs.
- **Scene triggers**: new weigh-in, workout logged, no workout for 2, 3, 5, 7
  or 14 days (once per threshold, kept across restarts).
- **Scene actions**: **add a weigh-in** to wger — a connected scale already in
  Gladys feeds wger; implausible values are refused, and the same weigh-in is
  never added twice — and read the week summary, with a ready sentence for a
  message.
- **Dashboard widget**: weight and its trend, workouts of the week, last
  workout, calories of the day, weight curve of the last 30 days.
- wger.de (cloud badge) or a server at home (local badge). Texts in English,
  French, German and Spanish.

Tested against a real wger server in Docker (wger 2.8.0, the version wger.de
runs, with PostgreSQL and Redis as in the official compose file): a test
account, weigh-ins, workout sessions, a nutrition plan and a food log created
through the API, a wrong key, wger's own refusal of a weight. Not tested
against a wger.de account: feedback welcome on
[the issues](https://github.com/guim31/gladys-wger/issues).

## Requirements

- Gladys Assistant 5.1.0 or later.
- A wger account (wger 2.6 or later recommended) reachable from Gladys, and
  its API key (wger: user menu → API key).

## Installation

In Gladys, **Integrations → Install from GitHub**, address
`https://github.com/guim31/gladys-wger`. Then enter the wger address
(`https://wger.de` by default) and the API key in the configuration, **Test
the connection**, and add the device from the **Discovery** tab. The full
guide: [docs/en.md](docs/en.md) ([fr](docs/fr.md), [de](docs/de.md),
[es](docs/es.md)).

## How it works

The container reads the REST API v2 of wger every 15, 30 or 60 minutes, on its
own timer (Gladys never polls the device, and the triggers work whether it is
added or not): `userprofile`, the last 100 `weightentry`, the last 50
`workoutsession`, the `nutritionplan` list and, when there is one, today's
`nutritiondiary` (the energy of each entry is read once, then cached). About
five requests per reading. Only the changed values are published to Gladys.
The state of the triggers is kept in `/data`, without any weight.

## Limits

- One wger account per integration.
- Weights are in the unit of the wger profile (kg or lb); changing it adds new
  features in the other unit.
- Read only, except the weigh-ins added by the scene action.
- Triggers are seen at the next reading: up to the refresh interval late.
- The JWT login of wger (user name and password) is not used: the API key is
  enough, and never expires unless you generate a new one.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the project rules and the notes on the wger
API.

## Credits

- [wger](https://github.com/wger-project/wger) by Roland Geider and the wger
  contributors (AGPL-3.0): the answers in `test/fixtures/wger` come from its
  Docker image `wger/server`, and the cover uses the wger logo from its
  repository (`wger/core/static/images/logos/logo-font-inverse.svg`).
- Built from the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js)
  and on the architecture of
  [gladys-nightscout](https://github.com/guim31/gladys-nightscout).

Unofficial integration, not affiliated with the wger project.

## License

Apache-2.0, see [LICENSE](LICENSE).
