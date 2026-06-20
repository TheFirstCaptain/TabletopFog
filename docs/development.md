# Development Environment

This document records baseline assumptions and commands for local development.

## Required Runtime

- Node.js 22.8.0 or newer is required. The precise minimum supports the built-in
  coverage include and threshold flags used by `npm run quality`.
- npm is used for dependency installation, development scripts, and tests.
- OpenSSL is required for the local development certificate helper.
- F-002 was locally verified on Node.js `v24.14.0` and npm `11.9.0`.
- Chromebook development assumes the Linux development environment is available.
- MacBook development assumes a normal terminal environment.
- Initial development and primary early validation will be performed on a MacBook Pro hosting the local server.
- Intended table use will still be validated on a Chromebook hosting the local server, with the iPad as the player client.

## Browser Targets

- GM view: Chrome on Chromebook first, Chrome or Safari on MacBook acceptable.
- Primary development clients: Safari on iPhone and Safari on iPad connected to the MacBook Pro host.
- Intended table client: Safari on iPad connected to the Chromebook host.
- Player display path: iPad mirrored to a TV.

## Local HTTPS

HTTPS is mandatory for the MVP local server.

Milestone 1 provides a development-only self-signed certificate workflow for home and friend Wi-Fi testing. Follow `docs/decisions/decision-007-local-https-certificates.md`.

Generated development private keys and certificates must not be committed to the repository.

Generate or regenerate local HTTPS files with:

```sh
npm run cert -- --ip=<LAN-IP>
```

The script writes ignored files to `certs/dev-key.pem` and `certs/dev-cert.pem`. It includes `localhost`, `127.0.0.1`, detected LAN IPv4 addresses, and any explicit `--ip=` values in the certificate SANs.

Regenerate the certificate whenever the GM machine changes Wi-Fi networks or LAN IP addresses.

For normal local startup, prefer the streamlined command:

```sh
npm run local
```

The command detects LAN IP addresses, reuses the existing certificate when it still covers the current addresses, regenerates it when needed, starts the HTTPS server on `0.0.0.0:3000`, and prints the GM URL, player URL candidates, certificate path, and Chromebook port-forwarding note.

If automatic LAN IP detection reports the wrong address, pass the Wi-Fi LAN IP explicitly:

```sh
npm run local -- --ip=<LAN-IP>
```

Initial iPhone/iPad trust workflow for validation:

1. Transfer `certs/dev-cert.pem` to the iPhone or iPad being tested.
2. Install the certificate profile when prompted by iOS or iPadOS.
3. Enable full trust for the installed certificate in device certificate trust settings.
4. Open `https://<LAN-IP>:3000/player` in Safari.

Record the exact observed iOS or iPadOS settings path and any Safari warning text in `docs/features/F-002.md` or `docs/network-troubleshooting.md` during physical device validation.

The default local server should serve both GM and player pages over HTTPS, for example:

```text
https://localhost:3000/gm
https://192.168.1.42:3000/player
```

## Local Campaign Data

Campaign and map library data defaults to:

```text
~/TabletopFog/tabletopfog-data/
```

Use `TABLETOPFOG_DATA_DIR` to point development or smoke tests at a temporary data root:

```sh
TABLETOPFOG_DATA_DIR=/private/tmp/tabletopfog-data npm run local
```

Campaign folders contain `campaign.json` and a `maps/` folder with copied map assets. These files are intended to be inspectable outside the app.

Map upload supports PNG, JPEG, GIF, and WebP files up to 100 MB. The server
checks image signatures, filename extensions, and content types before writing a
map file or changing campaign metadata.

## Validation Commands

Install dependencies:

```sh
npm install
```

Generate local HTTPS files:

```sh
npm run cert -- --ip=<LAN-IP>
```

Start the HTTPS server:

```sh
npm run dev
```

Start the HTTPS server with LAN IP detection, certificate check, and printed player URLs:

```sh
npm run local
```

Run automated tests:

```sh
npm test
```

Run the authoritative completion checks for code and tooling changes:

```sh
npm run quality
```

The quality command runs these read-only stages in order:

1. `npm run lint`
2. `npm run format:check`
3. `npm run modules:check`
4. `npm run harness:check`
5. `npm run test:coverage`
6. `npm run audit:high`

Use `npm run format` to apply Prettier to maintained JavaScript, JSON, CSS,
HTML, and YAML files. Markdown is intentionally excluded for now.

Node coverage currently includes `server/**/*.js` and `scripts/**/*.js` and
enforces baseline-derived floors of 76% lines, 69% branches, and 81% functions.
Browser scripts remain outside Node coverage until F-009D adds browser workflow
execution.

The dependency audit requires npm registry access. High and critical findings
block completion, moderate findings remain visible, and registry/network failure
is a failed quality run. There is no offline command that is equivalent to a
successful full quality run.

## Continuous Integration

GitHub Actions runs `.github/workflows/quality.yml` for every pull request and
every push to `main`. The workflow tests Node.js 22.8.0 and the current Node.js
24 line independently, installs dependencies with `npm ci`, and runs the same
`npm run quality` command documented above. Matrix fail-fast is disabled so a
failure on one runtime does not hide the other runtime's result.

The workflow has read-only repository permission, receives no application
secrets, and does not deploy or start TabletopFog. A failed stage prints its
local granular rerun command; start local reproduction with:

```sh
npm run quality
```

GitHub repository rulesets or branch protection must require the visible
`Quality / Node 22.8.0` and `Quality / Node 24` checks if merge blocking is
desired. That external setting is not controlled by the workflow file.

The module baseline in `quality/module-baseline.json` inventories production
JavaScript under `server/`, `public/`, and `scripts/`. Any new, removed, grown,
or reduced module requires an intentional baseline update. Growth also requires
an architecture disposition; reductions lower the ratchet.

The harness check validates phase-aware feature evidence, reviewer
independence, review scope, findings dispositions, tracker consistency, and the
closed legacy baseline. Its exact Markdown contract is documented in
`docs/features/FEATURE_TEMPLATE.md`.

## Test Fixtures and Failure Paths

Tests that cross an external-input boundary should use fixtures representative
of the production validation depth rather than arbitrary bytes with a plausible
filename. Derive a focused matrix from the actual boundary: relevant valid,
invalid, mismatched, size-boundary, and partial-failure cases. Do not apply
irrelevant cases mechanically.

For rejected mutations, assert both the returned error and the absence of
partial effects in every affected layer, such as copied files, campaign
metadata, and in-memory state. If a maintenance test exposes broken promised
behavior, record it as a bug before changing production code.

Tests that create directories under the operating-system temporary root must
use `createTemporaryDirectory` from `test-support/temp-directory.js` and pass
the current Node test context. The helper registers recursive idempotent
teardown; network servers and sockets still require explicit closure in
`finally` blocks.

The dev server binds to `0.0.0.0` on port `3000` by default so same-Wi-Fi devices can reach it by LAN IP.

## Troubleshooting

Use `docs/network-troubleshooting.md` when diagnosing iPad, LAN IP, firewall, VPN, or certificate trust failures.
