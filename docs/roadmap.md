# Roadmap

Feature-level planning and status tracking lives in
`docs/features/FEATURE_TRACKER.md`. Product language is defined in
`docs/ui-terminology.md`; design principles are defined in
`docs/design-language.md`.

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

Goal: Create or open a local campaign folder and manage multiple map-backed
encounters inside it.

Acceptance criteria:

- GM can create a campaign.
- GM can open an existing campaign.
- Campaigns are stored locally as folders.
- GM can upload or add maps as encounter assets in a campaign.
- Original file names are preserved as default map names.
- GM can rename maps later.
- GM can reorder maps manually.
- GM can explicitly show a map-backed encounter to players.
- Player Display shows only the encounter explicitly shown to players.
- Player Display remains read-only.
- No fog controls, initiative tracking, notes, or tokens are introduced.

Implementation notes:

- Campaigns, encounters, and maps are part of V1.
- Keep the storage format simple, local, inspectable, and migration-friendly.
- A first storage shape can use `~/TabletopFog/tabletopfog-data/<Campaign Name>/campaign.json` plus a `maps/` folder.
- [F-004A](./features/F-004A.md) adds a locally hosted fantasy display font and
  accessible parchment-inspired chrome without changing campaign or map
  behavior.

## Milestone 3: Static Active Map Display Polish

Goal: Harden and polish the legacy active-map display path on both GM View and
Player Display after the F-004 campaign library provides the minimal display
path.

Acceptance criteria:

- GM View and Player Display use consistent active-map rendering behavior.
- Map scales reasonably to available screen across desktop, iPad, and TV-like landscape viewports.
- Player Display can zoom and pan its map independently without changing the GM View or another Player Display.
- Active-map display handles refresh, reconnect, and image-load error states cleanly.
- Player Display receives only the active-map display state needed for read-only rendering.
- Player Display remains read-only.
- No fog controls are introduced.

Implementation notes:

- Use the campaign and map metadata from Milestone 2.
- Build on F-004's minimal active-map sync and display behavior.
- Keep GM View and Player Display viewport state local to each browser view so their controls can diverge later.
- In F-004 and F-005, the older term "active map" means the map currently shown
  to players. Later encounter-workflow features split that idea into a
  selected/editing encounter and a shown-to-players encounter.
  New UI should use `Shown to Players` instead of `active map`.

## Milestone 3 Follow-Up: Campaign and Encounter Workflow Polish

Goal: Make the prep workflow feel like a lightweight fantasy tabletop tool:
campaign cards lead to encounter cards, encounter cards open a GM workspace,
and showing an encounter to players remains an explicit action.

Completed feature sequence:

- [F-005A](./features/F-005A.md): campaign landing page polish.
- [F-005B](./features/F-005B.md): encounter card gallery and workspace entry.
- [F-005C](./features/F-005C.md): encounter workspace shell.
- [F-005D](./features/F-005D.md): navigation simplification.

Planned focused UI polish sequence before fog:

- Complete: [F-005E](./features/F-005E.md), campaign card presentation.
- Complete: [F-005F](./features/F-005F.md), encounter gallery presentation.
- Complete: [F-005G](./features/F-005G.md), encounter workspace layout.
- Complete: [F-005H](./features/F-005H.md), Manage Mode.
- Complete: [F-005K](./features/F-005K.md), clear shown encounter.
- Complete: [F-005L](./features/F-005L.md), delete encounters.
- Complete: [F-005M](./features/F-005M.md), delete campaigns.
- Active: [F-005I](./features/F-005I.md), design language compliance review.
- Proposed: [F-005J](./features/F-005J.md), final UI polish.
- Proposed: [F-006](./features/F-006.md), manual fog of war.

Status:

- Complete: [F-005A](./features/F-005A.md), campaign landing page polish.
- Complete: [F-005B](./features/F-005B.md), encounter card gallery and workspace entry.
- Complete: [F-005C](./features/F-005C.md), encounter workspace shell.
- Complete: [F-005D](./features/F-005D.md), navigation simplification.
- Complete: [F-005E](./features/F-005E.md), campaign card presentation.
- Complete: [F-005F](./features/F-005F.md), encounter gallery presentation.
- Complete: [F-005G](./features/F-005G.md), encounter workspace layout.
- Complete: [F-005H](./features/F-005H.md), Manage Mode.
- Complete: [F-005K](./features/F-005K.md), clear shown encounter.
- Complete: [F-005L](./features/F-005L.md), delete encounters.
- Complete: [F-005M](./features/F-005M.md), delete campaigns.
- Active: [F-005I](./features/F-005I.md), design language compliance review.
- Proposed: [F-005J](./features/F-005J.md), final UI polish.

Acceptance criteria:

- GM `/gm` starts on a fantasy-themed campaign landing page with campaign cards.
- Opening a campaign shows encounter cards with map thumbnails.
- Clicking an encounter card opens a selected/editing encounter workspace.
- Clicking or opening an encounter does not automatically change the Player Display.
- Showing an encounter to players is an explicit `Show to Players` action.
- Clearing the shown encounter is an explicit `Shown to Players` action.
- Deleting an encounter is a confirmed Manage Mode action and is blocked for
  encounters shown to players.
- Deleting a campaign is confirmed and allowed only after all encounters have
  been removed.
- The GM may prep one encounter while a different encounter remains shown to players.
- The Player Display changes only when the GM explicitly shows or clears an encounter.
- The current shown-to-players encounter is visually distinguished from the selected/editing encounter.
- No fog controls, tokens, notes, initiative tracking, dynamic lighting, campaign members, characters, or VTT-style navigation are introduced.
- Each proposed UI polish feature should remain small enough for one focused
  implementation session and should not bundle unrelated polish work.

Implementation notes:

- Prefer "encounter" in the UI for prepared map cards while preserving existing
  storage compatibility where current files and APIs still use `maps`.
- Existing `activeMapId` storage/API terminology currently represents the
  shown-to-players map, not necessarily the GM-selected editing encounter.
- Consider a future reviewed migration to clearer terminology such as
  `shownMapId`, but do not migrate storage casually.
- F-005D through F-005J intentionally split the remaining UI polish work before
  F-006 so navigation, campaign cards, encounter gallery, workspace layout,
  Manage Mode, review, and final polish can be reviewed independently.

## Milestone 4: Manual Fog of War

Goal: Add manual hide/reveal fog controls in the GM encounter workspace.

Acceptance criteria:

- Maps start visible.
- GM can add fog or hide areas on the selected/editing encounter using simple shapes such as rectangles or circles.
- GM can remove or reveal fog from hidden areas during play.
- Player receives fog updates only for the encounter currently shown to players.
- If the GM edits fog on an encounter not shown to players, the Player Display does not change.
- If the GM edits fog on the encounter currently shown to players, the Player Display updates live.
- Hidden areas remain hidden on the Player Display.
- Fog state belongs to a single encounter.
- No multiple fog states per encounter.
- No dynamic lighting, tokens, or vision cones are introduced.

Implementation notes:

- Do not implement the old full-black-fog-starts-over-the-map behavior.
- In V1, fog is used to hide areas on an otherwise visible map.
- Fog belongs to the encounter. The map is the visual asset fog is drawn over.
- Fog tools build on the F-005C encounter workspace and must preserve the
  selected/editing versus shown-to-players distinction.
- Canvas remains the preferred rendering layer.
- Start with simple hide/reveal geometry before adding brush polish.

## Milestone 5: Save and Load Campaign State

Goal: Complete campaign persistence for fog state and later restore workflows after F-004's basic campaign/map metadata persistence exists.

Acceptance criteria:

- Preserve F-004 campaign metadata, encounter/map list, ordering, display names,
  and shown-to-players behavior.
- Save fog state per encounter.
- Reload a campaign later.
- Restored Player Display matches saved shown-to-players encounter and fog state.
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
- Fullscreen Player Display.
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
