# TabletopFog

TabletopFog is a lightweight, locally hosted battlemap display and fog-of-war tool for in-person tabletop RPGs. It is designed for a GM running the app on a Chromebook or MacBook, with a player-facing iPad mirrored to a TV.

This project is intentionally not a full virtual tabletop. V1 includes local campaign folders and multiple maps per campaign for prep, but excludes tokens, character sheets, dice rolling, rules automation, NPC tracking, notes, login/auth, cloud hosting, dynamic lighting, and initiative tracking.

## Current Status

TabletopFog has completed the first local connectivity spike and is validating the campaign/map library milestone. The HTTPS app serves separate GM and player pages, stores local campaign folders, lets the GM manage maps, and syncs the selected active map to the read-only player display over Socket.IO.

Completed local-connectivity work proved:

- Run a local HTTPS server on the GM machine.
- Serve separate `/gm` and `/player` browser views.
- Connect an iPad over the same Wi-Fi using the GM machine's LAN IP address.
- Trigger a GM state change.
- Update the read-only player view live.

Current F-004 work adds local campaign and map library support. Campaigns are long-lived local folders, maps belong to campaigns, and maps start visible by default. Fog is added later to hide areas and then removed to reveal them during play.

Map upload accepts PNG, JPEG, GIF, and WebP files up to 100 MB and rejects data
whose image signature, filename extension, and content type do not agree.

By default, campaign data is stored outside the repo at:

```text
~/TabletopFog/tabletopfog-data/
```

For development or smoke testing, override the data root with:

```sh
TABLETOPFOG_DATA_DIR=/private/tmp/tabletopfog-data npm run local
```

## Documentation Map

- `docs/vision.md`: project purpose, MVP goal, target devices, and scope boundaries.
- `docs/architecture.md`: browser-first local architecture and GM/player responsibilities.
- `docs/roadmap.md`: milestone plan.
- `docs/features/FEATURE_TRACKER.md`: feature status and next work.
- `docs/bugs/BUG_TRACKER.md`: known defects and blockers.
- `docs/engineering/ENGINEERING_TRACKER.md`: behavior-preserving refactors,
  test hygiene, diagnostics, and maintenance.
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
- Local, inspectable files for campaign and map state.
- HTML Canvas for future map and fog rendering.

React, cloud hosting, databases, and native wrappers are deferred unless a later decision record changes direction.

## Working on Changes

Feature work is tracked in `docs/features/`. When starting a feature, read the docs first, clarify behavior, update the feature document, and follow the mandatory SDLC workflow in `docs/decisions/decision-004-mandatory-subagent-sdlc.md`.

Broken or unsafe promised behavior is tracked in `docs/bugs/`. Internal work
that intentionally preserves behavior is tracked in `docs/engineering/`. Use the
classification and workflows in `docs/ai-harness.md` before implementation.

Before marking a feature done, resolving a bug, or completing engineering
maintenance, check `docs/definition-of-done.md`.

## Current Validation Commands

Current setup and validation commands:

```sh
rg --files
git status --short
npm install
npm run local
npm test
```

`npm run local` detects LAN IP addresses, checks or regenerates the local HTTPS certificate when needed, starts the server, and prints the GM URL, player URL candidates, certificate path, and Chromebook notes.

If automatic LAN IP detection reports the wrong address, pass the Wi-Fi LAN IP explicitly:

```sh
npm run local -- --ip=<LAN-IP>
```

The lower-level commands remain available when needed:

```sh
npm run cert -- --ip=<LAN-IP>
npm run dev
```

The certificate helper and streamlined local startup require OpenSSL on the host machine.
