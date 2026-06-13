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
- Prefer Node.js, Express, and Socket.IO or WebSocket.
- Do not add accounts, tokens, dice, sheets, or combat features.

## Milestone 2: Static Map Display

Goal: Display the same map on GM and player views.

Acceptance criteria:

- GM can choose or load a map image.
- Player view displays the same map.
- Map scales reasonably to available screen.
- Player view remains read-only.

Implementation notes:

- Keep local image loading simple.
- Avoid persistent storage until Milestone 4 unless required by browser constraints.

## Milestone 3: Basic Fog of War

Goal: Add simple manual reveal controls.

Acceptance criteria:

- Full black fog layer starts over the map.
- GM can reveal simple shapes such as rectangles or circles.
- Player sees only revealed areas.
- Hidden areas remain hidden on the player display.
- No tokens or automation are introduced.

Implementation notes:

- Canvas is the preferred rendering layer.
- Start with simple reveal geometry before adding brush polish.

## Milestone 4: Save/Load State

Goal: Persist a session locally.

Acceptance criteria:

- Save current map and fog state locally.
- Reload a previous session.
- Restored player view matches the saved revealed state.

Implementation notes:

- Prefer local files or lightweight local storage.
- Do not introduce cloud storage for the MVP.

## Milestone 5: Quality-of-Life Improvements

Goal: Improve table usability after the core workflow is proven.

Acceptance criteria:

- Better reveal brush.
- Undo reveal.
- Clear fog or reset fog.
- Fullscreen player view.
- QR code or copied player URL.

Implementation notes:

- Keep each improvement independently useful.
- Update acceptance tests when behavior changes.

## Future Ideas Explicitly Out of MVP

These ideas may be revisited after the MVP succeeds:

- Initiative tracker module.
- Multiple maps or scenes.
- Campaign/session notes.
- Encounter tracker integration.
- Optional Electron wrapper.
- Dynamic lighting.
- Secret room layers.

Any future feature should be evaluated against the core purpose: a lightweight in-person battlemap display and fog-of-war tool.
