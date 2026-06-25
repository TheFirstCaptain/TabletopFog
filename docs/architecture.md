# Architecture

## MVP Architecture

TabletopFog should begin as a browser-first local web app served from the GM machine.

Recommended initial shape:

- A Node.js local server runs on the GM machine.
- Express serves static pages and lightweight API routes.
- Separate GM and player pages are served from the same server.
- Socket.IO pushes live state changes from GM to player.
- HTTPS is mandatory for the local server.
- HTML Canvas renders the map and fog layers.
- State is held in server memory for the first connectivity spike.

Campaign and map library work is part of V1 and should use local, inspectable folders and files rather than cloud storage.

Campaign reads should not rewrite local metadata. Normalization may shape the
in-memory representation, while repair or migration writes occur only during an
explicit mutation and preserve unrecognized metadata for forward compatibility.

## Runtime Model

The GM starts the server locally, then opens a GM URL such as:

```text
https://localhost:3000/gm
```

The iPad opens a player URL using the GM machine's LAN IP address, such as:

```text
https://192.168.1.42:3000/player
```

Both pages connect to the same local server. The GM page can send state updates. The player page receives state updates and renders them read-only.

## View Responsibilities

### GM View

The GM view owns control actions:

- Load or select a map image when that feature exists.
- Create or open a local campaign when that feature exists.
- Add, rename, reorder, and select maps in the active campaign when those features exist.
- Open a selected/editing encounter workspace without changing the player display
  when that feature exists.
- Explicitly show an encounter to players when that feature exists.
- Add fog to hide map areas and remove fog to reveal them when that feature exists.
- Reset or clear fog when that feature exists.
- Save or load local state when that feature exists.
- Display the current player URL or QR code when that feature exists.

### Player View

The player view is display-only:

- Render the currently visible map state.
- Render the encounter explicitly shown to players with GM-hidden areas obscured.
- Avoid controls that mutate session state.
- Allow local display controls such as map zoom and pan without sending those viewport changes to the GM, server, or other player displays.
- Support fullscreen display on iPad where possible.

The player view should not expose hidden map data through visible UI. Later implementation should also avoid sending unnecessary hidden state to the player when practical, but the MVP may first prove behavior before hardening transport-level data minimization.

## State Model

Initial state can be small and explicit:

- Current campaign identity.
- Current player-shown map identity or image source.
- Current GM selected/editing encounter identity, if that becomes shared state.
- Map list, display names, manual order, and active map.
- Map viewport/scaling information.
- Fog shapes or rasterized fog mask for each map.
- Last update timestamp or version number.

For F-004 and F-005, the implemented `active map` concept means the map shown
to players. F-005B distinguishes the GM-local selected/editing encounter from
the shown-to-players encounter. Opening an encounter for GM prep must not change
the player display; `Show to Players` is an explicit GM action.

Existing storage or API names such as `maps` and `activeMapId` may remain for
compatibility. Where `activeMapId` remains, treat it as the player-shown map,
not necessarily the GM-selected editing encounter. A future migration to clearer
terminology such as `shownMapId` should be reviewed separately rather than
bundled casually into UI or fog work.

Shown-to-players map identity and content are shared session state. GM
selected/editing encounter state may be client-local or separately scoped until
a feature requires sharing it. Viewport zoom and pan are client-local state:
each GM or player renderer owns its own viewport, resets when the
campaign-qualified rendered-map identity changes, and does not persist or
broadcast it.

For Milestone 1, a simple shared state value is enough to prove connectivity and live updates.

For the campaign library, the default local data root should be `~/TabletopFog/tabletopfog-data/`. A first storage shape can use `~/TabletopFog/tabletopfog-data/<Campaign Name>/`, a `campaign.json` file, and a `maps/` folder for image assets.

For manual fog, maps start visible by default. Fog state should represent hidden areas added by the GM and removals from those hidden areas, not a full black layer that must be revealed from total darkness. The representation should be saveable and replayed consistently later.

## Technology Direction

Recommended starting choices:

- Node.js for the local server.
- Express for serving pages.
- Socket.IO for live updates.
- HTTPS local serving.
- HTML Canvas for map and fog rendering.
- Plain HTML, CSS, and JavaScript at first.

Avoid React or a larger frontend framework unless a later milestone clearly benefits from it.

## Security and Network Assumptions

The MVP assumes trusted devices on the same Wi-Fi network. It does not include login or authentication.

The app should still avoid accidental write controls in the player view. Future hardening can add session codes, role-specific URLs, or simple local-only access controls if needed.

The MVP role model is route-based:

- `/gm` controls session state.
- `/player` renders read-only session state.

## Non-Goals

The architecture should not optimize for:

- Internet-hosted play.
- Cloud accounts.
- Marketplace asset management.
- Combat automation.
- Rules engine behavior.
- Token movement.
- Multi-user editing.
