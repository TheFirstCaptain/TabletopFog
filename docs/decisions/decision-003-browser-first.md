# Decision 003: Browser-First Implementation

## Context

The target GM device is a Chromebook first, with MacBook also acceptable. The player display is an iPad mirrored to a TV. A browser-first approach gives the project the broadest device compatibility with the least installation friction.

## Decision

TabletopFog will start as a browser-first local web app.

The recommended future technical direction is:

- Node.js local server.
- Express for serving pages.
- Socket.IO or WebSocket for live updates.
- HTML Canvas for map and fog rendering.
- Plain HTML, CSS, and JavaScript at first.

React or another frontend framework should be avoided unless a later milestone creates a clear need.

## Consequences

- The same implementation can serve GM and player views.
- iPad support can be tested directly in Safari.
- Chromebook support remains practical.
- The first implementation can avoid app stores, native packaging, and desktop installers.
- An optional Electron wrapper can remain a later idea without shaping the MVP.

## Alternatives Considered

- Native desktop app: rejected for MVP because Chromebook support and iPad player display are easier with a browser.
- React app from the start: deferred because the initial UI and rendering model should be simple enough for plain browser code.
- Electron-first app: deferred because it adds packaging concerns before local browser connectivity is proven.
