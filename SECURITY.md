# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration keeps and sends:

- Its configuration (the wger address and the API key of the account) is
  stored by Gladys and handed to the container. The key is only sent to the
  configured wger server, in the `Authorization` header, and never written to
  the logs, nor any weight, workout or calorie value.
- `/data/wger-state.json` holds the state of the scene triggers: a digest of
  the server and user name, the date of the last weigh-in and of the last
  workout, and which "no workout" thresholds were announced. No weight.
- Network: requests to the configured wger server only (GET, and a POST of a
  weigh-in when a scene asks for it). Redirects are not followed, so the key
  never goes elsewhere.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and wger itself (see the
[wger project](https://github.com/wger-project/wger)).
