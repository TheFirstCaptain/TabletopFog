# Decision 001: Local Hosting for MVP

## Context

TabletopFog is intended for in-person tabletop RPG sessions where the GM controls a map and fog-of-war display from a nearby machine. The player display is an iPad mirrored to a TV. The primary MVP goal is to prove that the app can run locally on the GM machine and be reached by the iPad over the same Wi-Fi network.

## Decision

The MVP will use local hosting. The GM machine will run a local server, and the iPad will connect using the GM machine's LAN IP address.

The MVP will not depend on cloud hosting, hosted accounts, or an external relay service.

## Consequences

- The app can work without internet access if the local network allows device-to-device traffic.
- Setup must make the local URL easy for the GM to find and share.
- Some guest Wi-Fi networks may block LAN device discovery or direct device-to-device connections.
- Future quality-of-life work may include a QR code or copied player URL.

## Alternatives Considered

- Cloud-hosted app: rejected for MVP because it adds accounts, deployment, internet dependency, and security concerns before the local workflow is proven.
- Native app only: rejected for MVP because browser-first delivery is more portable across Chromebook, MacBook, and iPad.
