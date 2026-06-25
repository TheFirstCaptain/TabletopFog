# Decision 002: Not a Full VTT

## Context

Many virtual tabletop tools include tokens, sheets, dice rollers, initiative, combat automation, rules integrations, chat, notes, and deep campaign management. TabletopFog is for in-person play with physical minis and a shared display.

## Decision

TabletopFog will not be a full VTT. V1 will focus on local connectivity, local
campaign, encounter, and map prep buckets, Shown to Players display behavior,
and manual fog-of-war hiding over visible maps.

The MVP will not include:

- Tokens.
- Initiative tracker.
- Character sheets.
- Dice roller.
- Rules automation.
- NPC tracking.
- Session or campaign notes.
- Dynamic lighting.

V1 will include local campaign folders and multiple maps per campaign only as preparation and display organization. This is not a broader campaign-management module.

Initiative tracking may be considered later as an optional v2/v3 module, but it is explicitly out of MVP scope.

## Consequences

- The app remains simpler to build, test, and use at the table.
- The UI can stay focused on campaign map selection, display, and manual hide/reveal workflows.
- Scope pressure should be evaluated against this decision before implementation.
- Future modules should remain optional and should not compromise the core lightweight map display experience.

## Alternatives Considered

- Build toward a full VTT: rejected because it conflicts with the target use case and would slow down the MVP.
- Add combat tools early: rejected because physical minis and existing table workflows already cover that need for the target user.
