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
3. Confirm each job installs with `npm ci` and runs `npm run quality`.
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

### Test: iPad Can Reach Player View

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
9. Confirm each player view updates without refresh.
10. Repeat the core iPad flow with the Chromebook as host.
11. Repeat on a friend's Wi-Fi network.

Expected result:

- GM and player pages both load over HTTPS.
- The iPhone and iPad reach the player view by LAN IP during MacBook Pro validation.
- The iPad reaches the player view by LAN IP during Chromebook validation.
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
- The player view receives the GM state change live.
- If the network blocks device-to-device traffic, the failure is documented clearly.

## Milestone 1: GM/Player State Sync

### Test: Live State Change Appears on Player View

Steps:

1. Open `https://localhost:3000/gm`.
2. Open `https://<LAN-IP>:3000/player` from another device or browser.
3. Click `Increment` in the GM view.

Expected result:

- The player view updates without a manual refresh.
- The displayed state matches the GM-triggered state.

## Milestone 1+: Player View Read-Only Behavior

### Test: Player Cannot Mutate Session State

Steps:

1. Open the player view.
2. Inspect the visible UI.
3. Try normal interactions such as tapping, dragging, refreshing, and using visible controls.

Expected result:

- The player view does not expose controls for changing map, fog, or session state.
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
10. Select one map as the active map.
11. Open the player view.
12. Attempt to add the invalid or unsupported file.
13. Reload the campaign library with the malformed campaign folder present.
14. Confirm the valid campaign remains listed and the malformed folder produces
    recovery guidance.
15. Confirm the malformed `campaign.json` was not modified.
16. Restart or reload the app and reopen the valid campaign.

Expected result:

- The campaign exists as a local folder.
- The campaign metadata records map names, file paths, order, active map, and empty fog state.
- Stored map filenames are filesystem-safe and collision-safe.
- Invalid, unsupported, or mismatched map image data is rejected without adding
  a map file or metadata entry.
- Invalid campaign metadata does not hide valid campaigns, produces actionable
  GM-visible recovery guidance, and is not rewritten automatically.
- The player view displays the active map.
- The player view remains read-only.
- No fog, initiative, notes, token, dice, or automation controls are present.

## Milestone 3: Static Active Map Display

### Test: Player View Follows Active Map Selection

Prerequisites:

- A campaign exists with at least two maps.
- GM and player views are open.

Steps:

1. Select the first map from the GM view.
2. Confirm the GM view displays the first map.
3. Confirm the player view displays the first map.
4. Select the second map from the GM view.
5. Confirm the GM and player views update without manual player refresh.
6. Resize the browser window and test the player view on iPad.

Expected result:

- GM and player views show the same active map.
- Map scaling remains reasonable on desktop and iPad.
- The player view remains read-only.
- No fog controls are present.

## Milestone 4: Manual Fog of War

### Test: Player Sees Hidden Areas Obscured

Prerequisites:

- A campaign and active map are loaded.
- Fog-of-war feature is implemented.

Steps:

1. Start with the active map visible.
2. Open both GM and player views.
3. Add fog over a rectangle or circle from the GM view.
4. Confirm the player view obscures that hidden area.
5. Remove or reveal part of the fog from the GM view.
6. Compare GM and player views.

Expected result:

- The map starts visible rather than covered by full black fog.
- The player view shows the same map with hidden areas obscured.
- Areas hidden by fog are not visible on the player display.
- Revealed or cleared areas become visible again.
- The player view does not show GM-only controls or hidden notes.

## Milestone 5: Save and Load Campaign State

### Test: Campaign State Restores Later

Prerequisites:

- A campaign exists with at least two maps.
- Fog-of-war feature is implemented.

Steps:

1. Rename and reorder maps in the campaign.
2. Select an active map.
3. Add fog to at least one map.
4. Save the campaign.
5. Restart or reload the app.
6. Open the saved campaign.
7. Open the player view.

Expected result:

- Campaign metadata reloads from local, inspectable files.
- Map names and manual ordering are restored.
- The saved active map is restored.
- Per-map fog state is restored.
- The player view matches the saved active map and fog state.
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
- Campaigns and maps are included in V1 only as local prep and display buckets, not as full VTT campaign management.
- Any new major feature has updated roadmap and acceptance criteria before implementation.
