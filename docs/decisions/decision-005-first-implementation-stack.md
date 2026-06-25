# Decision 005: First Implementation Stack

## Context

Milestone 1 needs a concrete stack so implementation can focus on proving local connectivity instead of reopening basic technology choices.

The app must run locally on the GM machine, serve separate GM View and Player
Display browser views, and push live state updates to the Player Display.

## Decision

The first implementation will use:

- Node.js on an active LTS release.
- npm scripts for development and validation.
- Express for serving pages and lightweight routes.
- Socket.IO for live state updates.
- Plain HTML, CSS, and JavaScript for the first UI.
- HTTPS for the local server.
- Default port `3000`, unless unavailable.

React, TypeScript, a database, cloud hosting, and large build tooling are deferred unless a later decision changes direction.

## Consequences

- Milestone 1 can focus on local HTTPS hosting and live sync.
- Socket.IO avoids hand-rolling reconnect and browser compatibility behavior during the spike.
- Plain browser code keeps the initial UI small and inspectable.
- HTTPS certificate setup becomes part of the MVP validation surface.
- The project must document how the GM reaches both `https://localhost:3000/gm` and the LAN IP player URL.

## Alternatives Considered

- Plain WebSocket: reasonable, but Socket.IO reduces early connectivity friction.
- React from the start: deferred because the first UI should be simple.
- HTTP-only local server: rejected because HTTPS is mandatory for this project.
- Cloud-hosted prototype: rejected because MVP success depends on same-Wi-Fi local hosting.
