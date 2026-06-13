# Decision 002: Not a Full VTT

## Context

Many virtual tabletop tools include tokens, sheets, dice rollers, initiative, combat automation, rules integrations, chat, and campaign management. TabletopFog is for in-person play with physical minis and a shared display.

## Decision

TabletopFog will not be a full VTT. The MVP will focus on local connectivity, map display, and manual fog-of-war reveal.

The MVP will not include:

- Tokens.
- Initiative tracker.
- Character sheets.
- Dice roller.
- Rules automation.
- NPC tracking.

Initiative tracking may be considered later as an optional v2/v3 module, but it is explicitly out of MVP scope.

## Consequences

- The app remains simpler to build, test, and use at the table.
- The UI can stay focused on display and reveal workflows.
- Scope pressure should be evaluated against this decision before implementation.
- Future modules should remain optional and should not compromise the core lightweight map display experience.

## Alternatives Considered

- Build toward a full VTT: rejected because it conflicts with the target use case and would slow down the MVP.
- Add combat tools early: rejected because physical minis and existing table workflows already cover that need for the target user.
