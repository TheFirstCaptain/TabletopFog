# UI Terminology

## Purpose

TabletopFog uses consistent product language so GMs can act quickly at the
table and future developers can reason about the same concepts without
translating between competing names.

Consistency reduces cognitive load. The UI should describe the GM's game-night
workflow, while implementation details can keep compatibility names where a
reviewed migration has not happened yet.

## Product Hierarchy

The primary product hierarchy is:

```text
Campaign
    ↓
Encounter
    ↓
Map
```

A campaign contains encounters. An encounter contains a map and future
encounter-specific state such as fog of war, initiative tracking, and other
table utilities. The map is one asset inside an encounter, not the top-level
workflow concept.

## User-Facing Terms

Use these terms in visible UI, user documentation, feature briefs, and
acceptance tests unless there is a specific reason to do otherwise.

| Term | Meaning |
| --- | --- |
| Campaign | A local collection of prepared encounters for an adventure or game. |
| Encounter | A prepared table moment inside a campaign. An encounter currently has one map and later owns fog and other encounter-specific tools. |
| Map | The image asset shown inside an encounter. Maps remain visually prominent, but they are not the primary workflow unit. |
| Encounter Workspace | The GM prep and running surface for one selected encounter. Opening it must not change the Player Display. |
| Player Display | The read-only player-facing browser view, usually on an iPad mirrored to a TV. |
| GM View | The GM-facing browser view that owns preparation and show controls. |
| Show to Players | The explicit action that updates what the Player Display shows. |
| Selected Encounter | The encounter the GM has opened or selected for prep/editing in the GM View. |
| Shown to Players | The encounter currently visible on the Player Display. |

Use `Shown to Players` for status text. Use `Show to Players` for the action.

## Internal Implementation Terms

Some existing storage, API, or code names still reflect earlier map-first
implementation phases. Those names may remain until a reviewed migration
explicitly changes them.

| Internal term | User-facing meaning |
| --- | --- |
| `maps` | Encounter map assets or legacy encounter records, depending on context. |
| `activeMapId` | The map for the encounter currently shown to players. It is not the GM's selected/editing encounter. |
| Active map | Legacy documentation term for the map currently shown to players. Prefer `Shown to Players` in new UI and workflow docs. |
| Player view | Existing implementation and test term for `/player`. Prefer `Player Display` in user-facing copy. |
| GM page | Existing implementation term for `/gm`. Prefer `GM View` in user-facing copy. |

Implementation terms should not leak into normal UI. For example, if storage or
APIs still use `activeMapId`, the UI should still say `Shown to Players`.

## Terms To Avoid

Avoid these terms unless a feature document or decision record explains why they
are necessary.

| Avoid | Reason |
| --- | --- |
| Scene | Common VTT terminology that makes TabletopFog feel broader than its intended physical-table scope. |
| Board | Vague; can mean a game board, whiteboard, or software board. Use `Encounter` or `Map`. |
| Canvas | Technical rendering detail. Use `Map` or `Encounter Workspace` unless discussing implementation. |
| Room | Too narrow for outdoor, abstract, or multi-room encounters. |
| Level | Ambiguous between dungeon level, character level, and software level. |
| Active map | Legacy implementation language. Use `Shown to Players` for user-facing status. |
| Publish, deploy, broadcast | Technical or production-coded language. Use `Show to Players`. |

## Core Workflow Language

Opening or editing an encounter is GM-local preparation. It must never change
the Player Display.

The game-night workflow should read:

```text
Open Campaign
Open Encounter
Show to Players
Run the Encounter
```

Any UI or documentation that implies opening an encounter changes the Player
Display should be corrected.
