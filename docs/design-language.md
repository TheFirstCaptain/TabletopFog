# TabletopFog Design Language

## Purpose

TabletopFog exists to support **in-person tabletop RPGs** using physical miniatures.

It is intentionally **not** a full Virtual Tabletop (VTT).

The application should disappear into the background, helping the Game Master run smoother sessions without becoming the focus of the table.

> **Quiet software. Better games.**

This document is part of the AI Harness and is considered authoritative for all future UI and UX decisions.

Use this document together with `docs/ui-terminology.md`, which defines the
approved product vocabulary for Campaigns, Encounters, Maps, the GM View, and
the Player Display.

---

# Guiding Principle

## The Map Is The Hero

The map is the most important element on every gameplay screen.

Everything else exists to help the GM get to the map quickly, prepare it efficiently, and present it to players without distraction.

Nothing in the interface should compete with the map.

---

# Principle 1 — One Question Per Screen

Every screen should answer exactly one question.

### Campaign Library

> Which campaign do I want?

### Campaign

> Which encounter do I want?

### Encounter Workspace

> What do I want to do with this encounter?

### Player Display

> What should the players see?

If a screen attempts to answer multiple questions, reconsider the design.

---

# Principle 2 — Calm Interface

TabletopFog should never feel busy.

Prefer:

- Whitespace
- Large cards
- Clear typography
- Simple layouts
- Obvious actions

Avoid clutter whenever possible.

When in doubt:

> Remove something.

---

# Principle 3 — Progressive Disclosure

Only show controls when they are needed.

Browsing should remain clean and focused.

Administrative functions such as:

- Rename
- Delete
- Reorder
- Upload

should only appear while managing content.

Preparation and administration should never overwhelm normal gameplay.

---

# Principle 4 — Maps First

Maps are the primary artifact.

Encounter thumbnails should be visually prominent.

The interface should emphasize encounters and maps—not administration.

The eye should naturally be drawn toward maps before anything else.

---

# Principle 5 — Never Surprise the GM

This is a foundational rule.

Opening an encounter must **never** change the Player Display.

Editing an encounter must **never** change the Player Display.

Only one explicit action changes what players see:

> **Show to Players**

This principle should never be violated.

---

# Principle 6 — Editing Is Different From Running

Preparation and gameplay are different experiences.

Preparation focuses on:

- Organizing encounters
- Renaming
- Uploading
- Reordering
- Preparing fog

Running focuses on:

- Showing encounters
- Revealing information
- Managing the flow of the game

The interface should support both mindsets without mixing their controls.

---

# Principle 7 — Game Concepts, Not Technical Concepts

The UI should present game concepts rather than implementation details.

Never expose technical information unless troubleshooting.

Avoid displaying:

- Filesystem paths
- Internal identifiers
- Storage locations
- API terminology

Instead present:

- Campaign names
- Encounter names
- Player-friendly language

The GM should think about adventures—not files.

---

# Principle 8 — Cards Over Tables

Campaigns should be represented as cards.

Encounters should be represented as cards.

Cards encourage browsing and exploration.

Tables encourage administration.

TabletopFog should almost always feel like browsing a collection rather than managing a database.

---

# Principle 9 — Consistent Navigation

Navigation should always remain obvious.

The hierarchy is:

```
Campaign Library
        ↓
Campaign
        ↓
Encounter Workspace
```

Users should never wonder where they are.

Every screen should have one obvious way back.

---

# Principle 10 — Designed For A Standing GM

The GM is rarely sitting quietly at a desk.

They are often:

- Standing
- Moving miniatures
- Looking at players
- Answering questions
- Running combat

The interface should respect that.

Use:

- Large buttons
- Generous click targets
- Simple interactions
- Minimal precision

The application should require as little attention as possible.

---

# Principle 11 — Respect The Table

TabletopFog supports the physical table.

It should never compete with:

- Painted miniatures
- Terrain
- Dice
- Rulebooks
- Roleplay
- Player interaction

The software exists to enhance the table—not replace it.

---

# Principle 12 — Prep Once, Run Smoothly

Preparation should make running the session effortless.

The ideal game-night workflow is:

```
Open Campaign

↓

Open Encounter

↓

Show to Players

↓

Run the Encounter
```

The reward for preparation should be simplicity.

---

# Principle 13 — Encounters Are The Primary Unit

The application organizes:

Campaigns

↓

Encounters

↓

Maps

The encounter—not the map—is the primary organizational concept.

Each encounter contains a map.

Future encounter-specific tools such as:

- Fog of War
- Initiative Tracking
- Encounter-specific utilities

belong to the encounter.

Think in terms of encounters, not standalone maps.

Opening or editing an encounter is separate from showing it to players. The
only player-display mutation is the explicit `Show to Players` action.

---

# Principle 14 — Rule Of Three

No screen should expose more than three primary actions.

Additional functionality should be grouped into:

- Secondary actions
- Manage Mode
- Contextual controls

If a screen requires four or more equally prominent actions, reconsider the layout.

---

# Design Personality

TabletopFog should feel like:

- A handcrafted GM notebook
- A premium board game companion
- Warm
- Calm
- Intentional
- Trustworthy
- Focused

It should **not** resemble:

- Enterprise software
- Administrative dashboards
- Aircraft cockpits
- Full-featured Virtual Tabletops

The software should quietly support the game rather than demanding attention.

---

# Applying These Principles

Before implementing any UI or UX change, ask:

- Does this support the map?
- Does this answer only one question?
- Does this reduce or increase clutter?
- Does this respect the physical table?
- Could this surprise the GM?
- Does it make game night smoother?

If a proposed feature conflicts with multiple principles in this document, reconsider the design before implementation.

This document is part of the AI Harness and should be treated as authoritative for all future user interface and user experience decisions.
