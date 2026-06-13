# Development Environment

This document records baseline assumptions for local development before Milestone 1 implementation begins.

## Required Runtime

- Node.js and npm are expected for the local server.
- The exact minimum Node.js version should be finalized during F-002, but prefer an active LTS release.
- Chromebook development assumes the Linux development environment is available.
- MacBook development assumes a normal terminal environment.

## Browser Targets

- GM view: Chrome on Chromebook first, Chrome or Safari on MacBook acceptable.
- Player view: Safari on iPad.
- Player display path: iPad mirrored to a TV.

## Local HTTPS

HTTPS is mandatory for the MVP local server.

Milestone 1 should provide a practical local certificate workflow for home and friend Wi-Fi testing. Follow `docs/decisions/decision-007-local-https-certificates.md`.

Generated development private keys and certificates must not be committed to the repository.

The default local server should serve both GM and player pages over HTTPS, for example:

```text
https://localhost:3000/gm
https://192.168.1.42:3000/player
```

## Validation Commands

No application commands exist yet. When implementation begins, add concrete commands here and to `AGENTS.md`, such as:

```sh
npm run dev
npm test
npm run lint
```

Every feature should leave behind the commands needed to run, test, and validate the changed behavior.

## Troubleshooting

Use `docs/network-troubleshooting.md` when diagnosing iPad, LAN IP, firewall, VPN, or certificate trust failures.
