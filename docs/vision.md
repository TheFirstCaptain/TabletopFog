# TabletopFog Vision

## Purpose

TabletopFog is a lightweight, locally hosted battlemap display and fog-of-war tool for in-person tabletop RPGs.

It helps a GM prepare local campaign map folders, show a shared map on a player-facing display, and hide secret or unrevealed areas with manual fog. It is designed for tables that use physical minis, paper notes, and in-person play, not for fully online play.

## Primary MVP Goal

Prove that a locally hosted app can run on the GM machine and be reached by an iPad on the same Wi-Fi network, both at home and on a friend's Wi-Fi.

The MVP succeeds when:

- A GM can start a local server on a Chromebook or MacBook.
- The GM can open a GM-facing browser page.
- An iPad can open a player-facing page using the GM machine's LAN IP address.
- The GM can trigger a simple state change.
- The player view updates live without cloud hosting.

## Target Users

- Primary user: a GM running an in-person tabletop RPG session.
- Secondary users: players looking at an iPad mirrored to a TV.

## Target Devices

- GM device: Chromebook first, MacBook acceptable.
- Player display: iPad mirrored to a TV.
- Network assumption: GM and player devices are on the same Wi-Fi network.

## Product Boundaries

TabletopFog is intentionally not a full virtual tabletop.

For the MVP, it will not include:

- Tokens.
- Initiative tracking.
- Encounter tracker integration.
- Character sheets.
- Dice rolling.
- Rules automation.
- NPC tracking.
- Session notes.
- Campaign notes.
- Dynamic lighting.
- Secret room layers.
- Cloud hosting.
- Login or authentication.

These exclusions are part of the product design, not temporary omissions to fill immediately.

## Core Principles

- Keep the app simple and lightweight.
- Prefer browser-first implementation.
- Use local hosting for the MVP.
- Keep GM view and player view separate.
- Keep player view read-only.
- Treat campaigns and maps as V1 prep and display buckets.
- Store campaign data locally in inspectable files.
- Start maps visible by default.
- Use fog to hide areas, then remove fog to reveal them during play.
- Add complexity only when it directly supports in-person battlemap display.

## Long-Term Direction

TabletopFog may eventually support optional quality-of-life features such as improved fog brushes, URL sharing, or an Electron wrapper. Initiative tracking, notes, tokens, character sheets, dice, NPC tracking, dynamic lighting, and encounter automation are outside V1 and should remain modular if considered later.
