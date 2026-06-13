# Development Environment

This document records baseline assumptions for local development before Milestone 1 implementation begins.

## Required Runtime

- Node.js and npm are expected for the local server.
- The exact minimum Node.js version should be finalized during F-002, but prefer an active LTS release.
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
