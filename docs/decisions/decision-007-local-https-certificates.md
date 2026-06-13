# Decision 007: Local HTTPS Certificate Strategy

## Context

HTTPS is mandatory for TabletopFog's MVP local server. The app must be reachable from an iPad over a LAN IP address, which means `https://localhost` alone is not enough. The project needs a repeatable local certificate workflow that works for Chromebook and MacBook hosting and can be validated on iPad Safari.

## Decision

Milestone 1 will use a development-only local certificate workflow generated on the GM machine.

The implementation should provide a documented command or script that creates local certificate files for development use. Generated private keys and certificates must not be committed to the repository.

The certificate workflow must support:

- `localhost`.
- `127.0.0.1`.
- The GM machine's current LAN IP address when practical.

iPad Safari trust steps must be documented as part of the manual validation flow. If iPad trust proves too cumbersome or network-dependent, the failure should be recorded in `docs/bugs/BUG_TRACKER.md` or the relevant feature document before changing strategy.

## Consequences

- HTTPS remains mandatory without introducing cloud hosting.
- Local setup becomes part of the MVP user workflow.
- LAN IP changes may require regenerating the development certificate.
- Browser or iPad trust prompts are expected during development and must be documented clearly.
- Future versions may replace this with a smoother pairing or certificate setup flow.

## Alternatives Considered

- HTTP-only local server: rejected because HTTPS is mandatory.
- Commit a shared development certificate: rejected because private keys should not live in the repo.
- Require `mkcert`: reasonable, but deferred as a hard dependency until F-002 confirms Chromebook and iPad setup behavior.
- Public CA certificate: rejected for MVP because local LAN IP hosting should not require public DNS or cloud infrastructure.
