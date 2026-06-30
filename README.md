# TabletopFog

TabletopFog is a lightweight, locally hosted battlemap display and fog-of-war tool for in-person tabletop RPGs. It is designed for a GM running the app on a Chromebook or MacBook, with a player-facing iPad mirrored to a TV.

This project is intentionally not a full virtual tabletop. V1 includes local campaign folders and multiple maps per campaign for prep, but excludes tokens, character sheets, dice rolling, rules automation, NPC tracking, notes, login/auth, cloud hosting, dynamic lighting, and initiative tracking.

## Current Status

TabletopFog has completed the first local connectivity spike, campaign/map
library, fantasy visual theme, active-map display polish, campaign landing page
polish, encounter gallery entry, and encounter workspace shell, including
Chromebook-host and iPad-player validation through F-005. The HTTPS app serves
separate GM View and Player Display pages, stores local campaign folders, lets
the GM manage map-backed encounter cards, and syncs only the current encounter
shown to players to the read-only Player Display over Socket.IO.

The quality gate runs Chromium characterization for current GM/player workflows
and theme behavior.

GM and player headings use a locally bundled EB Garamond display face. The GM
workspace and player status chrome use a parchment-inspired theme while the
player map stage remains dark for map contrast. No hosted font service is
required.

GM View and Player Display now share a canvas rendering foundation with centered
contain scaling. Player Zoom out, Fit map, Zoom in, drag, and pinch controls
change only that browser's local viewport; they do not mutate campaign state or
change the GM View or another Player Display.

The GM campaign landing page now uses calm campaign cards with balanced emoji
icons, editable names and two-line descriptions, quiet map and
`Shown to Players` metadata, restrained hover/focus states, and preserved
invalid-campaign diagnostics. Search/filtering and uploaded campaign images
remain deferred.

Opening a campaign now shows browse-first encounter cards with larger map
thumbnails, quiet management controls, `Selected for Prep` and
`Shown to Players` status badges, and explicit card-level `Show to Players`
actions. Clicking a currently shown encounter's `Shown to Players` action clears
the Player Display back to its waiting state and returns the action to
`Show to Players`. Normal browsing keeps upload, rename, reorder, and confirmed
permanent delete administration behind `Manage Encounters`; delete is blocked
only for encounters currently `Shown to Players`, with `Done Managing`
returning to the calm browse-first gallery. Campaign Library cards also support
confirmed permanent deletion for campaigns with no encounters; campaigns that
still contain encounters show a disabled delete action with guidance to remove
encounters first. The GM app header now keeps `TABLETOPFOG`, breadcrumb context,
and connection state in one compact row. Opening an encounter for prep enters a
focused GM workspace shell with a compact label/status/action strip, the
selected map as the dominant first-viewport surface, selected-versus-shown
status, a small fixed reserved future tools dock on desktop/Chromebook-sized
screens that stacks below the map on narrow screens, separate `Back to Campaign`
navigation, and a workspace-level `Show to Players` running action near the
title/status that can also clear when it reads `Shown to Players`. Campaign
screens use `Back to Campaign Library`, and normal GM UI avoids showing local
filesystem paths. Opening or navigating the workspace does not change the Player
Display. Existing storage still uses `maps` and
`activeMapId`, where `activeMapId` is an implementation detail meaning the
encounter currently shown to players until a reviewed migration chooses clearer
names. The UI should say `Shown to Players`.

Completed local-connectivity work proved:

- Run a local HTTPS server on the GM machine.
- Serve separate `/gm` and `/player` browser views.
- Connect an iPad over the same Wi-Fi using the GM machine's LAN IP address.
- Trigger a GM state change.
- Update the read-only Player Display live.

Completed F-004 work adds local campaign and map library support. Campaigns are
long-lived local folders, encounters are the primary prep units, maps are assets
inside encounters, and maps start visible by default. Fog is added later to hide
areas and then removed to reveal them during play.

Map upload accepts PNG, JPEG, GIF, and WebP files up to 100 MB and rejects data
whose image signature, filename extension, and content type do not agree.
The campaign library keeps valid campaigns available when another campaign has
invalid metadata and shows non-destructive recovery guidance for the skipped
folder.

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
- `docs/design-language.md`: authoritative UI and UX principles.
- `docs/ui-terminology.md`: user-facing and implementation terminology.
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
- HTML Canvas for current map rendering and future fog rendering.

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
npm run browser:install
npm run local
npm test
npm run test:browser
npm run quality
```

`npm run quality` is the authoritative completion check for code and tooling
changes. It runs linting, formatting checks, the module-growth ratchet, the
phase-aware AI harness compliance check, the full test suite with coverage
floors, Chromium GM/player workflow tests, and a high-severity dependency
audit. Run `npm run browser:install` after installing dependencies or updating
Playwright. The audit requires npm registry access; a network failure fails the
quality command rather than being treated as a pass.

GitHub Actions runs the same `npm run quality` command for every pull request
and every push to `main` on Node.js 22.8.0 and Node.js 24. A CI failure can be
reproduced locally with `npm run quality`; the failing quality stage also prints
its narrower rerun command. Repository rulesets or branch protection determine
whether GitHub blocks merging and are configured outside this repository.

Use `npm test` as the faster behavior-test loop while developing. Run
`npm run test:browser` for Chromium workflow characterization. Safari, iPad,
TV mirroring, LAN routing, and local certificate trust remain manual checks.
Run `npm run format` explicitly to apply formatting; the quality command is
read-only.

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
