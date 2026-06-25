# Roadmap

Feature-level planning and status tracking lives in `docs/features/FEATURE_TRACKER.md`.

## Milestone 0: Harness and Repo Structure

Goal: Create the documentation and validation harness for future AI-assisted development.

Acceptance criteria:

- Documentation exists.
- Acceptance tests are defined.
- Design decisions are recorded.
- Scope boundaries are explicit.
- Feature tracker and milestone feature briefs exist.

Status: complete.

## Cross-Cutting Engineering: Quality Gates

Goal: Make repository quality expectations executable and repeatable for local
development and proposed changes.

Tracked as [F-009](./features/F-009.md). This work covers tests, style checks,
dependency auditing, coverage policy, browser workflow validation, and
continuous integration without changing product behavior.

Quality-gate workstreams:

- Complete: [F-009A](./features/F-009A.md), local quality command and baseline
  enforcement.
- Complete: [F-009B](./features/F-009B.md), AI harness compliance and review
  evidence.
- Complete: [F-009C](./features/F-009C.md), continuous integration
  enforcement.
- Complete: [F-009D](./features/F-009D.md), Chromium browser workflow coverage.

Engineering prerequisites and supporting work are tracked in
`docs/engineering/`, including E-005 module baselines and E-006 test-fixture and
failure-path hardening.

Status: complete.

## Milestone 1: Local Connectivity Spike

Goal: Prove that the GM machine can host the app and an iPad can connect over the same Wi-Fi network.

Acceptance criteria:

- GM page is served from a local server.
- Player page is served from the same local server.
- iPad can connect using the GM machine's LAN IP address.
- GM can trigger a simple state change.
- Player view updates live.
- The same test works on home Wi-Fi and a friend's Wi-Fi.

Implementation notes:

- Use a simple shared state value before building map or fog features.
- Prefer Node.js, Express, Socket.IO, HTTPS, and plain browser code.
- Do not add accounts, tokens, dice, sheets, or combat features.

## Milestone 2: Campaign and Map Library

Goal: Create or open a local campaign folder and manage multiple maps inside it.

Acceptance criteria:

- GM can create a campaign.
- GM can open an existing campaign.
- Campaigns are stored locally as folders.
- GM can upload or add maps into a campaign.
- Original file names are preserved as default map names.
- GM can rename maps later.
- GM can reorder maps manually.
- GM can select an active map.
- Player view displays the active map.
- Player view remains read-only.
- No fog controls, initiative tracking, notes, or tokens are introduced.

Implementation notes:

- Campaigns and maps are part of V1.
- Keep the storage format simple, local, inspectable, and migration-friendly.
- A first storage shape can use `~/TabletopFog/tabletopfog-data/<Campaign Name>/campaign.json` plus a `maps/` folder.
- [F-004A](./features/F-004A.md) adds a locally hosted fantasy display font and
  accessible parchment-inspired chrome without changing campaign or map
  behavior.

## Milestone 3: Static Active Map Display Polish

Goal: Harden and polish the selected active campaign map display on both GM and player views after the F-004 campaign library provides the minimal display path.

Acceptance criteria:

- GM and player views use consistent active-map rendering behavior.
- Map scales reasonably to available screen across desktop, iPad, and TV-like landscape viewports.
- Player can zoom and pan its map independently without changing the GM view or another player display.
- Active-map display handles refresh, reconnect, and image-load error states cleanly.
- Player receives only the active-map display state needed for read-only rendering.
- Player view remains read-only.
- No fog controls are introduced.

Implementation notes:

- Use the campaign and map metadata from Milestone 2.
- Build on F-004's minimal active-map sync and display behavior.
- Keep GM and player viewport state local to each browser view so their controls can diverge later.
- In F-004 and F-005, the older term "active map" means the map currently shown
  to players. Later encounter-workflow features split that idea into a
  selected/editing encounter and a shown-to-players encounter.

## Milestone 3 Follow-Up: Campaign and Encounter Workflow Polish

Goal: Make the prep workflow feel like a lightweight fantasy tabletop tool:
campaign cards lead to encounter cards, encounter cards open a GM workspace,
and showing an encounter to players remains an explicit action.

Feature sequence:

- [F-005A](./features/F-005A.md): campaign landing page polish.
- [F-005B](./features/F-005B.md): encounter card gallery and workspace entry.
- [F-005C](./features/F-005C.md): encounter workspace shell.

Status:

- Complete: [F-005A](./features/F-005A.md), campaign landing page polish.
- Complete: [F-005B](./features/F-005B.md), encounter card gallery and workspace entry.
- Proposed: [F-005C](./features/F-005C.md), encounter workspace shell.

Acceptance criteria:

- GM `/gm` starts on a fantasy-themed campaign landing page with campaign cards.
- Opening a campaign shows encounter/map cards with thumbnails.
- Clicking an encounter card opens a selected/editing encounter workspace.
- Clicking or opening an encounter does not automatically change the player display.
- Showing an encounter to players is an explicit `Show to Players` action.
- The GM may prep one encounter while a different encounter remains shown to players.
- The player display changes only when the GM explicitly shows an encounter to players.
- The current shown-to-players encounter is visually distinguished from the selected/editing encounter.
- No fog controls, tokens, notes, initiative tracking, dynamic lighting, campaign members, characters, or VTT-style navigation are introduced.

Implementation notes:

- Prefer "encounter" in the UI for prepared map cards while preserving existing
  storage compatibility where current files and APIs still use `maps`.
- Existing `activeMapId` storage/API terminology currently represents the
  player-shown map, not necessarily the GM-selected editing encounter.
- Consider a future reviewed migration to clearer terminology such as
  `shownMapId`, but do not migrate storage casually.

## Milestone 4: Manual Fog of War

Goal: Add manual hide/reveal fog controls in the GM encounter workspace.

Acceptance criteria:

- Maps start visible.
- GM can add fog or hide areas on the selected/editing encounter using simple shapes such as rectangles or circles.
- GM can remove or reveal fog from hidden areas during play.
- Player receives fog updates only for the encounter currently shown to players.
- If the GM edits fog on an encounter not shown to players, the player display does not change.
- If the GM edits fog on the encounter currently shown to players, the player display updates live.
- Hidden areas remain hidden on the player display.
- Fog state belongs to a single encounter/map.
- No multiple fog states per encounter.
- No dynamic lighting, tokens, or vision cones are introduced.

Implementation notes:

- Do not implement the old full-black-fog-starts-over-the-map behavior.
- In V1, fog is used to hide areas on an otherwise visible map.
- Fog tools build on the F-005C encounter workspace and must preserve the
  selected/editing versus shown-to-players distinction.
- Canvas remains the preferred rendering layer.
- Start with simple hide/reveal geometry before adding brush polish.

## Milestone 5: Save and Load Campaign State

Goal: Complete campaign persistence for fog state and later restore workflows after F-004's basic campaign/map metadata persistence exists.

Acceptance criteria:

- Preserve F-004 campaign metadata, map list, ordering, map display names, and shown-to-players map behavior.
- Save fog state per encounter/map.
- Reload a campaign later.
- Restored player view matches saved shown-to-players encounter and fog state.
- Storage format is documented well enough to migrate later.
- No cloud storage or user accounts are introduced.

Implementation notes:

- Use local, inspectable files rather than cloud storage.
- Keep `campaign.json` simple and include enough structure for future migrations.
- Preserve the distinction between GM selected/editing encounter and
  shown-to-players encounter when persisting state.

## Milestone 6: Quality-of-Life Improvements

Goal: Improve table usability after the core workflow is proven.

Acceptance criteria:

- Better reveal/hide brush.
- Undo fog action.
- Clear fog or reset fog.
- Fullscreen player view.
- QR code or copied player URL.
- Better GM map controls if needed.

Implementation notes:

- Keep each improvement independently useful.
- Split this into child features before implementation if it grows too large.
- Update acceptance tests when behavior changes.

## Future Ideas Explicitly Out of V1

These ideas may be revisited after V1 succeeds:

- Initiative tracker module.
- Encounter tracker integration.
- Multiple campaigns open at once.
- Session notes.
- Campaign notes.
- Character sheets.
- Dice roller.
- Tokens.
- NPC tracking.
- Dynamic lighting.
- Secret room layers.
- Optional Electron wrapper.

Any future feature should be evaluated against the core purpose: a lightweight in-person battlemap display and fog-of-war tool.
