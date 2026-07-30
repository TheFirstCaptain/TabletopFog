# Architecture

## MVP Architecture

TabletopFog is a browser-first local web app served from the GM machine.

Recommended initial shape:

- A Node.js local server runs on the GM machine.
- Express serves static pages and lightweight API routes.
- Separate GM and player pages are served from the same server.
- Socket.IO pushes live state changes from GM to player.
- HTTPS is mandatory for the local server.
- HTML Canvas renders the map and future fog layers.
- State is held in server memory for the first connectivity spike.

Campaign, encounter, and map library work is part of V1 and should use local,
inspectable folders and files rather than cloud storage.

The primary product hierarchy is:

```text
Campaign
    ↓
Encounter
    ↓
Map
```

A campaign contains encounters. An encounter contains a map and future
encounter-specific state such as fog of war, initiative tracking if it is ever
approved after V1, and other encounter utilities. The map is one asset inside an
encounter, not the primary workflow unit.

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

Both pages connect to the same local server. The GM View can send explicit
state updates. The Player Display receives state updates and renders them
read-only.

## View Responsibilities

### GM View

The GM View owns control actions:

- Load or select a map image for an encounter when that feature exists.
- Create or open a local campaign when that feature exists.
- Add, rename, reorder, and select encounters in the active campaign when those features exist.
- Open a selected/editing encounter workspace without changing the Player Display
  when that feature exists.
- Explicitly show an encounter to players when that feature exists.
- Add and browse campaign-wide handouts when that feature exists.
- Explicitly show a handout to players or clear the Player Display when that
  feature exists.
- Rotate the shown handout in 90-degree increments when that feature exists.
- Add fog to hide map areas and remove fog to reveal them when that feature exists.
- Reset or clear fog when that feature exists.
- Save or load local state when that feature exists.
- Display the current player URL or QR code when that feature exists.

### Player Display

The Player Display is display-only:

- Render the target explicitly shown to players: empty, encounter, or handout.
- Obscure GM-hidden map areas when the shown target is an encounter with fog.
- Avoid controls that mutate session state.
- Allow local display controls such as map zoom and pan without sending those viewport changes to the GM, server, or other Player Displays.
- Support fullscreen display on iPad where possible.

The Player Display should not expose hidden map data through visible UI. Later
implementation should also avoid sending unnecessary hidden state to the player
when practical, but the MVP may first prove behavior before hardening
transport-level data minimization.

## State Model

Initial state can be small and explicit:

- Current campaign identity.
- Current shown-to-players target and image source.
- Current GM selected/editing encounter identity, if that becomes shared state.
- Encounter list, display names, manual order, and map assets.
- Map viewport/scaling information.
- Fog shapes or rasterized fog mask for each encounter.
- Last update timestamp or version number.

For F-004 and F-005, the implemented `active map` concept meant the map shown
to players. F-005B distinguishes the GM-local selected/editing encounter from
the shown-to-players encounter. F-010B migrates the shared display model to a
canonical `shownTarget`, which is either empty, an encounter, or a handout.
Opening an encounter or browsing a handout for GM prep must not change the
Player Display; `Show to Players` is an explicit GM action.
For shown handouts, `shownTarget` may include a `rotation` value of `0`, `90`,
`180`, or `270`. Rotation is shared shown-display state, not handout library
metadata, and it does not apply to encounters or fog.

Existing storage or API names such as `maps` may remain for compatibility.
Legacy `activeMapId` campaign files are read as an encounter `shownTarget` and
migrated on the next explicit save. Compatibility API routes may remain
temporarily but must not become the authoritative model again.

Shown-to-players target identity and content are shared session state. GM
selected/editing encounter state may be client-local or separately scoped until
a feature requires sharing it. Viewport zoom and pan are client-local state:
each GM or player renderer owns its own viewport, resets when the
campaign-qualified rendered-image identity changes, and does not persist or
broadcast it.

For Milestone 1, a simple shared state value is enough to prove connectivity and live updates.

For the campaign library, the default local data root should be
`~/TabletopFog/tabletopfog-data/`. The current storage shape uses
`~/TabletopFog/tabletopfog-data/<Campaign Name>/`, a `campaign.json` file, and a
`maps/` folder for image assets. Those storage names are implementation details;
the product model remains Campaign -> Encounter -> Map.

For manual fog, encounter maps start visible by default. Fog belongs to the
encounter and should represent hidden areas added by the GM and removals from
those hidden areas, not a full black layer that must be revealed from total
darkness. The representation should be saveable and replayed consistently
later.

## Technology Direction

Recommended starting choices:

- Node.js for the local server.
- Express for serving pages.
- Socket.IO for live updates.
- HTTPS local serving.
- HTML Canvas for map and fog rendering.
- Plain HTML, CSS, and JavaScript at first.

Avoid React or a larger frontend framework unless a later milestone clearly benefits from it.

See `docs/ui-terminology.md` for the distinction between user-facing
terminology and compatibility implementation names.

## Security and Network Assumptions

The MVP assumes trusted devices on the same Wi-Fi network. It does not include login or authentication.

The app should still avoid accidental write controls in the Player Display.
Future hardening can add session codes, role-specific URLs, or simple local-only
access controls if needed.

The MVP role model is route-based:

- `/gm` serves the GM View and controls session state.
- `/player` serves the read-only Player Display.

## Non-Goals

The architecture should not optimize for:

- Internet-hosted play.
- Cloud accounts.
- Marketplace asset management.
- Combat automation.
- Rules engine behavior.
- Token movement.
- Multi-user editing.
