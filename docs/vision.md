# TabletopFog Vision

## Purpose

TabletopFog is a lightweight, locally hosted battlemap display and fog-of-war tool for in-person tabletop RPGs.

It helps a GM show a shared map on a player-facing display while keeping unrevealed areas hidden. It is designed for tables that use physical minis, paper notes, and in-person play, not for fully online play.

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
- Character sheets.
- Dice rolling.
- Rules automation.
- NPC tracking.
- Cloud hosting.
- Login or authentication.

These exclusions are part of the product design, not temporary omissions to fill immediately.

## Core Principles

- Keep the app simple and lightweight.
- Prefer browser-first implementation.
- Use local hosting for the MVP.
- Keep GM view and player view separate.
- Keep player view read-only.
- Show the player only the map state the GM has revealed.
- Add complexity only when it directly supports in-person battlemap display.

## Long-Term Direction

TabletopFog may eventually support optional quality-of-life features such as save/load, multiple scenes, an initiative tracker module, or an Electron wrapper. These should remain modular and should not pull the project into full VTT scope.
