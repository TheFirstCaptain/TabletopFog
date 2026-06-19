# Development Environment

This document records baseline assumptions and commands for local development.

## Required Runtime

- Node.js 22 or newer is required for the local server.
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

The dev server binds to `0.0.0.0` on port `3000` by default so same-Wi-Fi devices can reach it by LAN IP.

## Troubleshooting

Use `docs/network-troubleshooting.md` when diagnosing iPad, LAN IP, firewall, VPN, or certificate trust failures.
