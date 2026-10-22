# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-22

### Added

- wger in Gladys: one device per account, from wger.de or a self-hosted
  server, with the last weight, its change over 7 and 30 days, the BMI when
  wger knows the height, the days since the last weigh-in, the workouts of
  the week, the days since the last workout, the last workout (day, notes or
  routine) and the calories logged today when a nutrition plan is used.
- Scene triggers: new weigh-in, workout logged, no workout for 2 to 14 days
  (once per threshold, kept across restarts).
- Scene actions: add a weigh-in (from a connected scale in Gladys; implausible
  values refused, the same weigh-in never added twice) and read the week
  summary, with a ready sentence for a message.
- Dashboard widget: weight and its trend, workouts of the week, last
  workout, calories of the day and the weight curve of the last 30 days.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-wger/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-wger/releases/tag/v1.0.0
