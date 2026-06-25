# Decision 006: Session and Role Model

## Context

TabletopFog has two separate browser views: GM View and Player Display. The GM
controls state. The Player Display is read-only and mirrored to a TV. The MVP
does not include accounts, login, or cloud hosting.

## Decision

The MVP will use route-based roles:

- `/gm` is the controlling view.
- `/player` is the read-only display view.

Both views are served by the same local HTTPS server. The app assumes trusted devices on the same Wi-Fi network. There is no login or authentication for the MVP.

The Player Display must not expose UI controls that mutate session state.
GM-originated state changes are broadcast to connected Player Display views.

## Consequences

- The role model is simple and visible in the URL.
- Player read-only behavior is a UI and server-event contract, not an authentication boundary.
- Anyone on the trusted LAN who knows the GM URL could open the GM view during MVP.
- Future hardening may add session codes, GM-only pairing, or local role tokens if needed.

## Alternatives Considered

- Login/auth for MVP: rejected because the app targets trusted local table use and should remain lightweight.
- Single page with role toggle: rejected because separate routes are clearer for GM/player responsibilities.
- Cloud session rooms: rejected because the MVP must not depend on cloud hosting.
