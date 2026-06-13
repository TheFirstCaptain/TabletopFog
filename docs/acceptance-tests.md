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

## Milestone 1: MacBook Pro Hosting

### Test: GM Can Host Locally from MacBook Pro

Prerequisites:

- MacBook Pro has the required runtime installed for the implementation milestone.
- MacBook Pro, iPhone, and iPad are on the same Wi-Fi network.

Steps:

1. Start the local server on the MacBook Pro.
2. Open the GM page in the MacBook browser.
3. Identify the MacBook Pro's LAN IP address.
4. Open the player URL from the iPhone using that LAN IP address.
5. Open the player URL from the iPad using that LAN IP address.

Expected result:

- The GM page loads locally.
- The player page loads from the MacBook Pro's LAN IP address on both iPhone and iPad.
- Both pages are served over HTTPS.
- No cloud hosting or external account is required.

## Milestone 1: Chromebook Hosting

### Test: GM Can Host Locally from Chromebook

Prerequisites:

- Chromebook has the required runtime installed for the implementation milestone.
- Chromebook and iPad are on the same Wi-Fi network.

Steps:

1. Start the local server on the Chromebook.
2. Open the GM page in the Chromebook browser.
3. Identify the Chromebook's LAN IP address.
4. Open the player URL from another browser tab or device using that LAN IP address.

Expected result:

- The GM page loads locally.
- The player page loads from the Chromebook's LAN IP address.
- Both pages are served over HTTPS.
- No cloud hosting or external account is required.

## Milestone 1: iPad Connection on Same Wi-Fi

### Test: iPad Can Reach Player View

Prerequisites:

- GM host machine and iPad are connected to the same Wi-Fi network.
- Local server is running on the GM host machine.

Steps:

1. On the iPad, open Safari.
2. Navigate to the HTTPS player URL using the GM host machine's LAN IP address.
3. Confirm the player page loads.

Expected result:

- The iPad displays the player page.
- The player page connects to the local server.
- The connection uses HTTPS.
- No login is required.

## Milestone 1: Manual Connectivity Script

### Test: End-to-End HTTPS Local Sync

Prerequisites:

- GM machine has Node.js/npm installed.
- Local HTTPS certificate setup is complete for the implementation milestone.
- GM machine, iPhone, and iPad are on the same Wi-Fi network for primary MacBook Pro validation.

Steps:

1. Start the local HTTPS server on the MacBook Pro.
2. Open `https://localhost:3000/gm` on the GM machine.
3. Find the GM machine's LAN IP address.
4. Open `https://<LAN-IP>:3000/player` on the iPhone and iPad.
5. Accept or trust the local development certificate if the documented setup requires it.
6. Trigger the simple GM state change.
7. Confirm each player view updates without refresh.
8. Repeat the core iPad flow with the Chromebook as host.
9. Repeat on a friend's Wi-Fi network.

Expected result:

- GM and player pages both load over HTTPS.
- The iPhone and iPad reach the player view by LAN IP during MacBook Pro validation.
- The iPad reaches the player view by LAN IP during Chromebook validation.
- Player views receive live state updates.
- Any LAN isolation or certificate failure is documented clearly.

## Milestone 1: Friend's Wi-Fi Test

### Test: App Works on a Different Local Network

Prerequisites:

- GM machine and iPad are connected to a friend's Wi-Fi network.
- The network allows devices to talk to each other on the LAN.

Steps:

1. Start the local server on the GM machine.
2. Find the GM machine's LAN IP address on the friend's Wi-Fi.
3. Open the GM page on the GM machine.
4. Open the player URL on the iPad using the LAN IP address.
5. Trigger a simple GM state change.

Expected result:

- The iPad reaches the player page.
- The player view receives the GM state change live.
- If the network blocks device-to-device traffic, the failure is documented clearly.

## Milestone 1: GM/Player State Sync

### Test: Live State Change Appears on Player View

Steps:

1. Open the GM view.
2. Open the player view from another device or browser.
3. Use the GM view to trigger a simple state change.

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

## Milestone 3: Fog Reveal Correctness

### Test: Player Sees Only Revealed Areas

Prerequisites:

- A map is loaded.
- Fog-of-war feature is implemented.

Steps:

1. Start with full fog enabled.
2. Open both GM and player views.
3. Reveal a rectangle or circle from the GM view.
4. Compare GM and player views.

Expected result:

- The player view shows the revealed map area.
- Unrevealed areas remain black or otherwise hidden.
- The player view does not show GM-only controls or hidden notes.

## Scope Control

### Test: No Accidental VTT Scope Creep

Steps:

1. Inspect the implemented UI and code for the current milestone.
2. Look for features outside the approved milestone scope.
3. Compare changes against `docs/roadmap.md` and decision records.

Expected result:

- MVP work does not include tokens, character sheets, dice roller, rules automation, NPC tracking, cloud hosting, or login/auth.
- Initiative tracking is not implemented in the MVP.
- Any new major feature has updated roadmap and acceptance criteria before implementation.
