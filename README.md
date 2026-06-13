# TabletopFog

TabletopFog is a lightweight, locally hosted battlemap display and fog-of-war tool for in-person tabletop RPGs. It is designed for a GM running the app on a Chromebook or MacBook, with a player-facing iPad mirrored to a TV.

This project is intentionally not a full virtual tabletop. The MVP excludes tokens, character sheets, dice rolling, rules automation, NPC tracking, login/auth, cloud hosting, and initiative tracking.

## Current Status

TabletopFog is in the planning and validation-harness phase. No application code has been built yet.

The first implementation milestone is a local connectivity spike:

- Run a local HTTPS server on the GM machine.
- Serve separate `/gm` and `/player` browser views.
- Connect an iPad over the same Wi-Fi using the GM machine's LAN IP address.
- Trigger a simple GM state change.
- Update the read-only player view live.

## Documentation Map

- `docs/vision.md`: project purpose, MVP goal, target devices, and scope boundaries.
- `docs/architecture.md`: browser-first local architecture and GM/player responsibilities.
- `docs/roadmap.md`: milestone plan.
- `docs/features/FEATURE_TRACKER.md`: feature status and next work.
- `docs/bugs/BUG_TRACKER.md`: known defects and blockers.
- `docs/acceptance-tests.md`: human-readable validation tests.
- `docs/decisions/`: architecture decision records.
- `docs/development.md`: runtime, HTTPS, browser, and command assumptions.
- `docs/definition-of-done.md`: checklist before marking a feature complete.
- `docs/network-troubleshooting.md`: LAN, firewall, VPN, and certificate troubleshooting.
- `docs/ai-harness.md`: rules for future AI-assisted development.

## Planned Technical Direction

- Node.js local server.
- Express for serving pages and lightweight routes.
- Socket.IO for live updates.
- HTTPS for local serving.
- Plain HTML, CSS, and JavaScript at first.
- HTML Canvas for future map and fog rendering.

React, cloud hosting, databases, and native wrappers are deferred unless a later decision record changes direction.

## Working on Features

Feature work is tracked in `docs/features/`. When starting a feature, read the docs first, clarify behavior, update the feature document, and follow the mandatory SDLC workflow in `docs/decisions/decision-004-mandatory-subagent-sdlc.md`.

Before marking a feature done, check `docs/definition-of-done.md`.

## Current Validation Commands

There is no build system yet. Current checks are documentation-oriented:

```sh
rg --files
git status --short
```
