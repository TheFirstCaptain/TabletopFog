# Decision 009: GM-First Encounter Workflow

## Context

TabletopFog supports an in-person GM who prepares and runs encounters while
players look at a read-only Player Display. The product is becoming more
encounter-centered, and future feature work needs a durable rule for what
changes the player-facing display.

Decision records 001 through 008 already exist. This record uses 009 to keep
decision numbering unique and chronological.

## Decision

Editing and showing are separate.

Opening, selecting, or editing an encounter in the GM View must never change
the Player Display. Only the explicit `Show to Players` action updates what
players see.

Encounter is the primary unit.

Campaigns contain encounters. Encounters contain maps. Future
encounter-specific functionality belongs to the encounter, including:

- Fog of war.
- Initiative tracking if it is ever approved after V1.
- Other encounter utilities.

The architecture should avoid designing around maps alone. A map is an asset
inside an encounter.

TabletopFog remains browser first.

The application is designed around a browser experience. Desktop packaging may
come later, but it should not drive architecture.

TabletopFog remains local first.

Campaign data belongs to the user. Campaigns are stored locally. Cloud
synchronization is not part of the core architecture.

TabletopFog remains physical-table first.

The application complements physical miniatures, terrain, dice, and in-person
play. It intentionally avoids becoming a full Virtual Tabletop.

## Consequences

- The GM can prep one encounter while another encounter remains shown to
  players.
- Future fog state belongs to the selected/editing encounter and is only sent to
  players when that encounter is shown or already shown.
- UI must use explicit `Show to Players` language for player-display changes.
- Storage and API names such as `activeMapId` may remain temporarily for
  compatibility, but they are implementation details and must not define the
  user-facing model.
- Future initiatives, utilities, or table aids should be scoped to encounters
  and evaluated against the non-VTT product boundary.
- Browser, local storage, and same-Wi-Fi assumptions remain architectural
  defaults unless a later decision changes them.

## Alternatives Considered

- Opening an encounter automatically shows it to players: rejected because it
  surprises the GM and makes prep risky during a live session.
- Keep map as the primary product unit: rejected because fog, initiative, and
  table utilities belong to the encounter the GM is running, not to an image
  file by itself.
- Desktop-first packaging: rejected because Chromebook and iPad browser use are
  central to the product.
- Cloud sync as a default architecture: rejected because local-first ownership
  and no-account setup are core TabletopFog constraints.
- Grow toward a full VTT: rejected because TabletopFog is a focused physical
  table companion.
