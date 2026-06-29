# Acceptance Tests

These are human-readable acceptance tests for the early project. They are not necessarily automated yet. Future implementation work should convert stable checks into automated tests where useful.

## Milestone 0: Harness and Repo Structure

### Test: Documentation Scaffold Exists

Steps:

1. Inspect the repository.
2. Confirm `docs/vision.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/acceptance-tests.md`, and `docs/ai-harness.md` exist.
3. Confirm `docs/decisions/` contains initial decision records.

Expected result:

- The documentation structure exists and describes project scope, architecture, roadmap, acceptance tests, AI workflow, and decisions.

## Cross-Cutting Engineering: Continuous Integration

### Test: Proposed Changes Run the Authoritative Quality Command

Prerequisites:

- The repository is hosted on GitHub with Actions enabled.
- A pull request can be opened against `main`.

Steps:

1. Open or update a pull request with a change that passes `npm run quality`
   locally.
2. Confirm the `Quality / Node 22.8.0` and `Quality / Node 24` jobs both run.
3. Confirm each job installs with `npm ci`, provisions Chromium, and runs
   `npm run quality`.
4. Push a controlled change that makes one quality stage fail.
5. Confirm both matrix jobs complete and the workflow is unsuccessful.
6. Confirm the failed stage prints the corresponding local rerun command.
7. Remove the controlled failure and confirm both jobs pass.
8. After merging, confirm a push to `main` starts the same matrix workflow.

Expected result:

- Pull requests and pushes to `main` run the complete local quality policy on
  Node.js 22.8.0 and Node.js 24 without changed-file scoping.
- A failure on one matrix entry does not cancel the other entry.
- Required failures are visible and make the workflow unsuccessful.
- Contributors can reproduce the failure with `npm run quality` or the narrower
  command printed by the failed stage.
- The workflow uses no application secrets and does not deploy the app.
- Merge blocking applies only when the repository's external ruleset or branch
  protection requires the two matrix checks.

## Cross-Cutting Engineering: Browser Workflow Coverage

### Test: Chromium Characterizes Current GM and Player Workflows

Prerequisites:

- Dependencies and the version-matched Chromium binary are installed with
  `npm install` and `npm run browser:install`.
- OpenSSL is available for isolated test certificates.

Steps:

1. Run `npm run test:browser`.
2. Confirm campaign creation, library return, and campaign reopening pass.
3. Confirm invalid upload rejection and valid PNG upload pass.
4. Confirm map rename, reorder, and boundary controls pass.
5. Confirm active-map changes reach the already-open Player Display.
6. Confirm player zoom and pan remain local to that Player Display while the GM
   View and a second Player Display remain unchanged.
7. Confirm the player exposes no shared-state mutation controls and a
   player-originated GM request is rejected.
8. Confirm offline/online recovery reports `Reconnecting...` and returns to
   `Live`.
9. Confirm a failed active-map image displays the error message and hides the
   failed image.
10. Confirm a delayed older image cannot replace a newer active map.

Expected result:

- All Chromium workflow tests pass against isolated HTTPS servers and temporary
  campaign data.
- Temporary data, certificates, sockets, listeners, and browser contexts are
  cleaned up after each test.
- The suite runs as a required stage of `npm run quality` locally and in CI.
- The result makes no claim about Safari, physical iPad or TV behavior, LAN
  routing, Chromebook hosting, or certificate trust.

## Milestone 2 Follow-Up: Fantasy Visual Theme

### Test: Theme Loads Locally and Preserves Map Contrast

Prerequisites:

- The local HTTPS server is running.
- GM View and Player Display can be opened in Chromium.

Steps:

1. Open the GM campaign library and confirm headings use the bundled EB
   Garamond display font.
2. Confirm controls, diagnostics, status text, filenames, and dense body text
   retain the system-font stack.
3. Confirm the GM page and panels use the parchment palette with readable text,
   statuses, diagnostics, controls, borders, and focus indicators.
4. Navigate the GM form and controls with the keyboard and confirm the focused
   element has a visible outline.
5. Open the Player Display and confirm its status bar uses parchment chrome while
   the map stage remains dark.
6. Block the local WOFF2 request and reload the GM view.
7. Confirm the declared serif fallback leaves headings, labels, controls, and
   workflows usable.
8. Repeat the GM and player checks at a 390 px viewport with a long displayed
   data-root path.

Expected result:

- Font loading is same-origin and requires no hosted service at runtime.
- The superseded Middleearth TTF is absent.
- Text and focus combinations meet the documented contrast thresholds.
- The page does not overflow horizontally at the narrow viewport.
- Campaign/map workflows, player read-only behavior, synchronization, and dark
  map framing remain unchanged.
- Physical Safari, iPad, Chromebook, TV, LAN, and certificate behavior remains
  a separate manual validation boundary.

## Milestone 1: MacBook Pro Hosting

### Test: GM Can Host Locally from MacBook Pro

Prerequisites:

- MacBook Pro has Node.js 22.8.0 or newer, npm, and OpenSSL installed.
- MacBook Pro, iPhone, and iPad are on the same Wi-Fi network.
- Local HTTPS certificate files have been generated with `npm run cert -- --ip=<LAN-IP>`.

Steps:

1. Run `npm install` if dependencies are not installed.
2. Run `npm run cert -- --ip=<LAN-IP>` if the LAN IP has changed.
3. Start the local server on the MacBook Pro with `npm run dev`.
4. Open `https://localhost:3000/gm` in the MacBook browser.
5. Identify the MacBook Pro's LAN IP address.
6. Install and fully trust the local development certificate on iPhone and iPad if required.
7. Open `https://<LAN-IP>:3000/player` from the iPhone.
8. Open `https://<LAN-IP>:3000/player` from the iPad.
9. Click `Increment` in the GM page.

Expected result:

- The GM page loads locally.
- The player page loads from the MacBook Pro's LAN IP address on both iPhone and iPad.
- Both pages are served over HTTPS.
- The counter update appears on the iPhone and iPad without manual refresh.
- No cloud hosting or external account is required.

## Milestone 1: Chromebook Hosting

### Test: GM Can Host Locally from Chromebook

Prerequisites:

- Chromebook has Linux development environment enabled with Node.js 22.8.0 or
  newer, npm, and OpenSSL installed.
- Chromebook and iPad are on the same Wi-Fi network.
- Local HTTPS certificate files have been generated with `npm run cert -- --ip=<LAN-IP>`.

Steps:

1. Run `npm install` if dependencies are not installed.
2. Run `npm run cert -- --ip=<LAN-IP>` if the LAN IP has changed.
3. Start the local server on the Chromebook with `npm run dev`.
4. Open `https://localhost:3000/gm` in the Chromebook browser.
5. Identify the Chromebook's LAN IP address.
6. Enable ChromeOS Linux port forwarding for TCP port `3000` if it is not already enabled.
7. Install and fully trust the local development certificate on the iPad if required.
8. Open `https://<LAN-IP>:3000/player` from the iPad.
9. Click `Increment` in the GM page.

Expected result:

- The GM page loads locally.
- The player page loads from the Chromebook's LAN IP address.
- Both pages are served over HTTPS.
- The counter update appears on the iPad without manual refresh.
- No cloud hosting or external account is required.
- If the Chromebook cannot open its own Wi-Fi LAN IP URL while the iPad can, use `https://localhost:3000/...` or `https://penguin.linux.test:3000/...` for Chromebook-local testing and treat the Wi-Fi IP failure as a ChromeOS local loopback limitation.

## Milestone 1: iPad Connection on Same Wi-Fi

### Test: iPad Can Reach Player Display

Prerequisites:

- GM host machine and iPad are connected to the same Wi-Fi network.
- Local server is running on the GM host machine.
- The local development certificate includes the GM host machine's LAN IP address.

Steps:

1. On the iPad, open Safari.
2. Navigate to the HTTPS player URL using the GM host machine's LAN IP address.
3. Install and fully trust the local development certificate if required.
4. Confirm the player page loads.

Expected result:

- The iPad displays the player page.
- The player page connects to the local server.
- The connection uses HTTPS.
- No login is required.

## Milestone 1: Streamlined Local Startup

### Test: End-to-End HTTPS Local Sync

Prerequisites:

- GM machine has Node.js/npm and OpenSSL installed.
- GM machine, iPhone, and iPad are on the same Wi-Fi network for primary MacBook Pro validation.

Steps:

1. Run `npm install`.
2. Run `npm run local`.
3. If the printed player URL does not use the GM machine's Wi-Fi LAN IP, stop the server and run `npm run local -- --ip=<LAN-IP>`.
4. Confirm the command prints the GM URL, player URL, certificate path, and Chromebook port-forwarding note.
5. Open the printed GM URL on the GM machine.
6. Install and fully trust the printed local development certificate on the iPhone and iPad if required.
7. Open the printed player URL on the iPhone and iPad.
8. Trigger the simple GM counter increment.
9. Confirm each Player Display updates without refresh.
10. Repeat the core iPad flow with the Chromebook as host.
11. Repeat on a friend's Wi-Fi network.

Expected result:

- GM and player pages both load over HTTPS.
- The iPhone and iPad reach the Player Display by LAN IP during MacBook Pro validation.
- The iPad reaches the Player Display by LAN IP during Chromebook validation.
- Player views receive live state updates.
- The local command reuses an existing trusted certificate when it still covers the current LAN IP, and regenerates it only when needed.
- Any LAN isolation or certificate failure is documented clearly.

## Milestone 1: Friend's Wi-Fi Test

### Test: App Works on a Different Local Network

Prerequisites:

- GM machine and iPad are connected to a friend's Wi-Fi network.
- The network allows devices to talk to each other on the LAN.

Steps:

1. Find the GM machine's LAN IP address on the friend's Wi-Fi.
2. Regenerate the certificate with `npm run cert -- --ip=<LAN-IP>`.
3. Start the local server on the GM machine with `npm run dev`.
4. Open `https://localhost:3000/gm` on the GM machine.
5. Install and fully trust the local development certificate if required.
6. Open `https://<LAN-IP>:3000/player` on the iPad.
7. Trigger a simple GM counter increment.

Expected result:

- The iPad reaches the player page.
- The Player Display receives the GM state change live.
- If the network blocks device-to-device traffic, the failure is documented clearly.

## Milestone 1: GM/Player State Sync

### Test: Live State Change Appears on Player Display

Steps:

1. Open `https://localhost:3000/gm`.
2. Open `https://<LAN-IP>:3000/player` from another device or browser.
3. Click `Increment` in the GM view.

Expected result:

- The Player Display updates without a manual refresh.
- The displayed state matches the GM-triggered state.

## Milestone 1+: Player Display Read-Only Behavior

### Test: Player Cannot Mutate Session State

Steps:

1. Open the Player Display.
2. Inspect the visible UI.
3. Try normal interactions such as tapping, dragging, refreshing, and using visible controls.

Expected result:

- The Player Display does not expose controls for changing map, fog, or session state.
- Player interactions do not mutate GM state.

## Milestone 2: Campaign and Map Library

### Test: GM Can Manage Maps in a Local Campaign

Prerequisites:

- Local server is running on the GM host machine.
- At least two representative PNG, JPEG, GIF, or WebP map image files are
  available.
- An invalid or unsupported file is available for rejection testing.
- A second campaign folder with malformed `campaign.json` is available for
  non-destructive diagnostic testing.

Steps:

1. Open the GM view.
2. Create a campaign named `The Long Walk`.
3. Confirm the campaign is stored as a local folder with inspectable metadata.
4. Add two maps to the campaign.
5. Confirm each map display name defaults to its original file name without the extension.
6. Add another map with the same original file name.
7. Confirm both duplicate-named maps are retained with unique stored filenames.
8. Rename both maps.
9. Reorder the maps manually.
10. Use `Show to Players` for one map-backed encounter.
11. Open the Player Display.
12. Attempt to add the invalid or unsupported file.
13. Reload the campaign library with the malformed campaign folder present.
14. Confirm the valid campaign remains listed and the malformed folder produces
    recovery guidance.
15. Confirm the malformed `campaign.json` was not modified.
16. Restart or reload the app and reopen the valid campaign.

Expected result:

- The campaign exists as a local folder.
- The campaign metadata records map names, file paths, order, the shown-to-players map, and empty fog state.
- Stored map filenames are filesystem-safe and collision-safe.
- Invalid, unsupported, or mismatched map image data is rejected without adding
  a map file or metadata entry.
- Invalid campaign metadata does not hide valid campaigns, produces actionable
  GM-visible recovery guidance, and is not rewritten automatically.
- The Player Display displays the shown-to-players map.
- The Player Display remains read-only.
- No fog, initiative, notes, token, dice, or automation controls are present.

## Milestone 3: Static Active Map Display

### Test: Player Display Follows Show to Players

Prerequisites:

- A campaign exists with at least two maps.
- GM View and Player Display are open.

Steps:

1. Use `Show to Players` for the first map-backed encounter from the GM View.
2. Confirm the GM View displays the first map.
3. Confirm the Player Display displays the first map.
4. Click the first encounter's `Shown to Players` action.
5. Confirm the Player Display returns to its waiting state and the first
   encounter action changes back to `Show to Players`.
6. Use `Show to Players` for the second map-backed encounter from the GM View.
7. Confirm the GM View and Player Display update without manual player refresh.
8. Use Zoom in, Zoom out, Fit map, drag pan, pinch zoom, and keyboard arrow pan
   in the Player Display.
9. Confirm the GM View and a second Player Display remain unchanged.
10. Resize the browser window and test the Player Display on iPad and a TV-like
   landscape viewport.
11. Disconnect and reconnect the player while zoomed, then refresh the page.

Expected result:

- GM View and Player Display show the same shown-to-players map.
- Map scaling uses centered contain behavior on desktop, iPad, and TV-like
  landscape viewports.
- Player zoom is bounded from 50% through 300%, supports local pan, resets when
  the active map changes or the page reloads, and remains unchanged through a
  same-map reconnect or resize.
- Player viewport changes do not mutate campaign or session state and do not
  change the GM View or another Player Display viewport.
- Clearing the shown encounter leaves no encounter marked `Shown to Players`
  and does not delete, rename, or reorder any encounter.
- Switching between campaigns resets the Player Display viewport even when both active
  maps have the same map ID.
- If the active-map image cannot load, the player reports the error and does
  not display stale canvas content.
- A delayed response for an older map cannot replace the current active map.
- The Player Display remains read-only.
- No fog controls are present.

Terminology note:

- For F-004 and F-005, `active map` means the map currently shown to players.
  Future encounter-workflow features split this into a selected/editing
  encounter and a shown-to-players encounter.

## Milestone 3 Follow-Up: Campaign Landing Page

### Test: GM Opens Campaign Cards

Prerequisites:

- Local server is running on the GM host machine.
- At least one valid campaign exists.
- At least one invalid campaign folder exists for diagnostic coverage.

Steps:

1. Open `/gm`.
2. Confirm campaigns display as cards rather than a plain list.
3. Confirm each card shows the campaign name and any available description,
   icon, and lightweight metadata.
4. Click a campaign card.
5. Return to the campaign landing page.
6. Edit the campaign name, emoji icon, and short description.
7. Reload the page and confirm the edited name, emoji, and description persist.
8. Try an invalid metadata edit and confirm a GM-visible validation error appears.
9. Confirm editing campaign metadata does not reload or change the Player Display.
10. Create a new campaign from the landing page.
11. Review invalid campaign diagnostics.
12. Repeat at a Chromebook-sized viewport.

Expected result:

- The campaign landing page keeps the fantasy/parchment theme.
- Campaign cards open the selected campaign.
- Campaign names, emoji icons, and descriptions are editable, persisted, and
  shown on campaign cards.
- Invalid metadata edits are rejected without corrupting campaign files.
- Metadata-only edits do not change the shown-to-players map or force a Player
  Display reload.
- New campaign creation remains available.
- Invalid campaign diagnostics remain visible and usable.
- The layout fits Chromebook-sized screens.
- Campaign search/filtering and uploaded campaign images remain deferred.
- No fog, token, notes, member, character, cloud, or VTT-style navigation
  controls are present.

### Test: Campaign Cards Remain Calm With Long Text

Prerequisites:

- Local server is running on the GM host machine.
- Multiple campaigns exist, including one with a long campaign name, one with a
  160-character description, one with no description, and one with a long
  `Shown to Players` encounter name.
- At least one invalid campaign folder exists for diagnostic coverage.
- Player Display is open in a separate browser view with a known shown-to-players
  encounter.

Steps:

1. Open `/gm`.
2. Confirm campaign cards keep the campaign icon, campaign name, description,
   and metadata visually distinct.
3. Confirm long descriptions are clamped to two lines.
4. Confirm long `Shown to Players` metadata remains quiet and secondary.
5. Hover a campaign card and confirm the hover state is visible but restrained.
6. Navigate by keyboard and confirm focus remains visible on real controls such
   as `Open`, `Edit`, form fields, `Save`, and `Cancel`.
7. Open edit mode for a campaign card and confirm the card remains usable.
8. Repeat at Chromebook-sized and narrow viewports.
9. Confirm invalid campaign diagnostics remain visible.
10. Open a campaign from a card and confirm normal navigation still works.
11. Return to the Player Display and confirm the shown encounter did not change
    during card review, hover, focus, edit mode, or campaign opening.

Expected result:

- Campaign cards remain cards, not tables or dashboards.
- Long campaign names, descriptions, and shown-to-players metadata stay inside
  each card without horizontal overflow.
- Missing descriptions use the existing fallback.
- Hover and focus states are clear, accessible, and restrained.
- Campaign creation, opening, metadata editing, invalid diagnostics, and Player
  Display behavior remain unchanged.

### Test: GM Deletes Empty Campaigns

Prerequisites:

- Local server is running on the GM host machine.
- One campaign exists with no encounters.
- One campaign exists with at least one encounter.
- Player Display is open or otherwise known to be unaffected.

Steps:

1. Open `/gm` at the Campaign Library.
2. Confirm each campaign card has a secondary `Delete...` action.
3. Confirm the campaign with encounters has delete disabled and shows a visible
   reason to delete its encounters first.
4. Click delete for the empty campaign.
5. Cancel the confirmation.
6. Confirm the empty campaign still appears.
7. Click delete for the empty campaign again.
8. Confirm the deletion.
9. Reload the Campaign Library.

Expected result:

- Campaign deletion requires confirmation.
- Canceling leaves the empty campaign folder and card intact.
- Confirming permanently removes the empty campaign folder and card.
- Campaigns with encounters cannot be deleted from the UI or direct GM API.
- Player Display remains read-only and unchanged by campaign deletion.

## Milestone 3 Follow-Up: Encounter Gallery

### Test: Opening an Encounter Does Not Show It to Players

Prerequisites:

- A campaign exists with at least two maps.
- GM View and Player Display are open.
- One encounter is already shown to players.

Steps:

1. Open the campaign from the campaign landing page.
2. Confirm maps display as encounter cards with visually prominent thumbnails.
3. Confirm the currently shown-to-players encounter is visually distinguished.
4. Click a different encounter card thumbnail to open its in-page workspace placeholder.
5. Confirm the Player Display does not change.
6. Use the card-level explicit `Show to Players` action for that encounter.

Expected result:

- Encounter cards preserve add/upload, rename, and reorder workflows.
- The selected/editing encounter is distinct from the shown-to-players encounter.
- Opening or selecting an encounter for editing does not update the Player Display.
- The Player Display changes only after the explicit `Show to Players` action.
- Existing storage may still use `maps`, and existing `activeMapId` terminology
  represents the shown-to-players map until a reviewed migration changes it.

### Test: Encounter Gallery Is Browse-First

Prerequisites:

- A campaign exists with zero, one, and multiple encounter states available for
  review.
- Test encounters include long encounter names plus landscape, portrait, and
  square map images.
- GM View and Player Display are open.
- One encounter is already shown to players.

Steps:

1. Open the campaign from the Campaign Library.
2. Confirm Add Encounter uses the existing map upload path but appears as a
   restrained secondary affordance inside the encounter gallery.
3. Add or inspect several encounters with varied thumbnail aspect ratios.
4. Confirm thumbnails are visually prominent and remain inside their cards.
5. Confirm long encounter names wrap inside cards without horizontal overflow.
6. Confirm `Shown to Players` and `Selected for Prep` appear as restrained,
   distinct text badges.
7. Confirm `Show to Players` remains available in Normal Mode.
8. Enter `Manage Encounters`.
9. Confirm Add Encounter, Rename, Up, Down, and Delete controls remain
   available there but do not visually dominate browsing.
10. Confirm Delete is disabled with a visible reason for encounters that are
   `Shown to Players`.
11. Confirm Delete remains available for encounters that are only
   `Selected for Prep`.
12. Cancel deletion of an encounter that is not shown to players.
13. Confirm the encounter, map asset, order, and Player Display remain unchanged.
14. Confirm deletion of an encounter that is not shown to players.
15. Confirm the encounter is permanently removed, remaining order is repaired,
   and the Player Display remains unchanged.
16. Return to Normal Mode.
17. Open an encounter that is not shown to players.
18. Confirm the Player Display does not change.
19. Use `Show to Players` and confirm the Player Display changes only then.
20. Click that encounter's `Shown to Players` action and confirm the Player
    Display returns to waiting state.
21. Confirm the encounter action changes back to `Show to Players`.
22. Repeat at Chromebook-sized and narrow widths.

Expected result:

- Encounter cards feel like browsing prepared encounters rather than managing
  files.
- The map thumbnail, encounter name, and shown/editing status carry the card
  hierarchy.
- Add Encounter, rename, reorder, and confirmed delete remain available through
  Manage Mode while Normal Mode stays uncluttered.
- Permanent delete requires confirmation and is blocked only for encounters
  shown to players.
- Explicit show behavior remains available in Normal Mode.
- Explicit shown behavior clears the Player Display and then returns to the
  show action without editing encounter metadata.
- The gallery remains responsive and touch-friendly without horizontal
  overflow.

### Test: Encounter Gallery Separates Browsing From Managing

Prerequisites:

- A campaign exists with zero, one, and multiple encounter states available for
  review.
- GM View and Player Display are open.
- One encounter is already shown to players.

Steps:

1. Open a campaign in Normal Mode.
2. Confirm `Manage Encounters` is visible.
3. Confirm Normal Mode shows encounter thumbnails, names, status badges,
   open-for-prep actions, and explicit `Show to Players` actions.
4. Confirm Normal Mode does not show Add Encounter upload, Rename, Up, Down, or
   Delete controls.
5. Open an encounter for prep and confirm the Player Display remains on the
   previously shown encounter.
6. Return to the campaign and choose `Manage Encounters`.
7. Confirm `Done Managing`, Add Encounter upload, Rename, Up, Down, and Delete
   controls are visible.
8. Confirm Delete is blocked with visible reason text for the encounter
   currently shown to players.
9. Confirm Delete remains available for the encounter selected for prep when it
   is not shown to players.
10. Cancel deletion of an encounter that is not shown to players.
11. Confirm the encounter list, order, files, selected prep badge, shown badge,
    and Player Display remain unchanged.
12. Confirm deletion of an encounter that is not shown to players.
13. Confirm the encounter is removed, remaining order is repaired, and the
    Player Display does not reload or change.
14. Rename and reorder encounters.
15. Upload a valid encounter and confirm it appears.
16. Attempt an invalid upload.
17. Choose `Done Managing`.

Expected result:

- Normal Mode remains focused on browsing, opening, and explicitly showing
  encounters to players.
- Manage Mode exposes upload, rename, reorder, and confirmed permanent delete
  administration controls.
- Delete is blocked for shown-to-players encounters and remains available for
  selected-for-prep encounters that are not shown.
- Rename, reorder, valid upload, invalid upload, canceled delete, rejected
  delete, and confirmed unshown/unselected delete do not change the Player
  Display or the shown-to-players encounter.
- Invalid upload preserves encounter names, order, and shown state.
- Returning to Normal Mode hides administration controls again.

## Milestone 3 Follow-Up: Encounter Workspace

### Test: GM Can Prep One Encounter While Another Is Shown

Prerequisites:

- A campaign exists with at least two maps.
- GM View and Player Display are open.
- One encounter is shown to players.

Steps:

1. Open a different encounter workspace from the encounter gallery.
2. Confirm the workspace shows the selected/editing encounter name and map.
3. Confirm the workspace status identifies both the selected/editing encounter
   and the encounter currently `Shown to Players` when they differ.
4. Navigate back to the encounter gallery.
5. Return to the workspace.
6. On desktop or Chromebook-sized screens, confirm the map is the dominant
   workspace element and the reserved future tool dock sits laterally beside it.
7. On a narrow screen, confirm the reserved future tool dock stacks below the
   map and the page has no horizontal overflow.
8. Confirm the workspace includes reserved future fog-tool space without fog controls.
9. Confirm `Show to Players` sits in a dedicated running-actions area near the
   title/status, not over the map.
10. Click the workspace `Show to Players` action.
11. Click the workspace `Shown to Players` action.
12. Confirm the workspace status changes to `Shown to Players: None` and the
    workspace action changes back to `Show to Players`.

Expected result:

- The workspace uses the existing canvas renderer for the GM map view.
- The GM can inspect or prep one encounter while another remains shown to players.
- Player Display remains unchanged until `Show to Players` is clicked.
- The workspace `Shown to Players` action clears the Player Display without
  changing the selected/editing encounter.
- Workspace navigation back to the encounter gallery is clear.
- The workspace makes the map prominent, keeps future tool space reserved
  without adding fog controls yet, and remains usable at desktop,
  Chromebook-sized, and narrow viewports.
- Rename, reorder, and upload remain gallery workflows for this feature.

## Milestone 3 Follow-Up: Navigation Simplification

### Test: GM Navigation Uses One Clear Back Action

Prerequisites:

- A campaign exists with at least two maps.
- GM View and Player Display are open.
- One encounter is shown to players.

Steps:

1. Open the Campaign Library.
2. Confirm the page title and breadcrumb identify `Campaign Library`.
3. Confirm normal GM UI does not show the local data root or full filesystem paths.
4. Open a campaign.
5. Confirm the page title identifies `Campaign`, the breadcrumb shows
   `Campaign Library / <campaign>`, and there is one visible Back action.
6. Open an Encounter Workspace.
7. Confirm the page title identifies `Encounter Workspace`, the breadcrumb shows
   `Campaign Library / <campaign> / <encounter>`, and there is one visible Back
   action.
8. Navigate back to the Campaign screen, then back to the Campaign Library.
9. Repeat the navigation at a 390 px viewport.

Expected result:

- Breadcrumbs are informational and do not compete with the Back action.
- The Campaign screen backs to Campaign Library.
- The Encounter Workspace backs to Campaign.
- Normal GM UI avoids filesystem paths and implementation-focused labels.
- Opening or navigating away from an Encounter Workspace does not change the
  Player Display.
- The Player Display changes only after the GM clicks `Show to Players`.

## Milestone 4: Manual Fog of War

### Test: Player Sees Hidden Areas Obscured

Prerequisites:

- A campaign exists with at least two encounters/maps.
- The encounter workspace feature is implemented.
- Fog-of-war feature is implemented.

Steps:

1. Show one encounter to players.
2. Open a different selected/editing encounter in the GM workspace.
3. Add fog over a rectangle or circle in the selected/editing encounter.
4. Confirm the Player Display does not change.
5. Use `Show to Players` for the selected/editing encounter.
6. Confirm the Player Display shows that encounter with the hidden area obscured.
7. Remove or reveal part of the fog from the GM workspace.
8. Confirm the Player Display updates live because this encounter is now shown to players.
9. Open another encounter in the GM workspace and edit its fog without showing it.

Expected result:

- Maps start visible rather than covered by full black fog.
- Fog belongs to the selected/editing encounter being edited.
- The Player Display shows fog updates only for the shown-to-players encounter.
- Editing fog on a non-shown encounter does not change the Player Display.
- Areas hidden by fog are not visible on the Player Display.
- Revealed or cleared areas become visible again.
- GM fog is semi-transparent unless implementation review chooses a better
  accessible treatment; player fog is opaque or near-opaque.
- The Player Display does not show GM-only controls or hidden notes.

## Milestone 5: Save and Load Campaign State

### Test: Campaign State Restores Later

Prerequisites:

- A campaign exists with at least two maps.
- Fog-of-war feature is implemented.

Steps:

1. Rename and reorder maps in the campaign.
2. Show one encounter to players.
3. Add fog to at least one encounter.
4. Save the campaign.
5. Restart or reload the app.
6. Open the saved campaign.
7. Open the Player Display.

Expected result:

- Campaign metadata reloads from local, inspectable files.
- Map names and manual ordering are restored.
- The saved shown-to-players encounter is restored.
- Per-encounter fog state is restored.
- The Player Display matches the saved shown-to-players encounter and fog state.
- GM selected/editing encounter state is not confused with the shown-to-players
  encounter.
- No cloud storage or user account is required.

## Scope Control

### Test: No Accidental VTT Scope Creep

Steps:

1. Inspect the implemented UI and code for the current milestone.
2. Look for features outside the approved milestone scope.
3. Compare changes against `docs/roadmap.md` and decision records.

Expected result:

- MVP work does not include tokens, character sheets, dice roller, rules automation, NPC tracking, cloud hosting, or login/auth.
- Initiative tracking is not implemented in the MVP.
- Campaigns, encounters, and maps are included in V1 only as local prep and
  display buckets, not as full VTT campaign management.
- Any new major feature has updated roadmap and acceptance criteria before implementation.
