# Repository Guidelines

## Project Structure & Module Organization

TabletopFog is in the early local campaign and map implementation phase.

- `docs/vision.md`: purpose, users, MVP boundaries.
- `docs/architecture.md`: technical direction and view responsibilities.
- `docs/roadmap.md`: milestones and out-of-MVP ideas.
- `docs/features/`: feature tracker, feature template, and milestone feature briefs.
- `docs/bugs/`: bug tracker and bug template.
- `docs/engineering/`: engineering-maintenance tracker, template, and records.
- `docs/acceptance-tests.md`: human-readable validation tests.
- `docs/development.md`: runtime, HTTPS, and command assumptions.
- `docs/definition-of-done.md`: completion checklist.
- `docs/ai-harness.md`: rules for future AI-assisted development.
- `docs/decisions/`: architecture and product decision records.
- `server/`: HTTPS Express and Socket.IO server code.
- `public/`: browser pages and client-side JavaScript.
- `scripts/`: local development helper scripts.
- `test/`: Node test suite.

## Build, Test, and Development Commands

Current validation commands:

```sh
rg --files
git status --short
npm install
npm run cert -- --ip=<LAN-IP>
npm run dev
npm test
```

Use `rg --files` to confirm files. Use `git status --short` before and after changes.
Use `npm run cert -- --ip=<LAN-IP>` whenever the host machine changes Wi-Fi networks or LAN IP addresses.

## Coding Style & Naming Conventions

Use concise Markdown with descriptive headings.

For decision records, use the naming pattern:

```text
docs/decisions/decision-NNN-short-topic.md
```

Use ASCII unless a file already requires otherwise. For future JavaScript, prefer plain HTML/CSS/JS first, small modules, and names that describe user-facing behavior.

## Testing Guidelines

Acceptance tests are currently human-readable and live in `docs/acceptance-tests.md`. Update that file whenever behavior or milestone scope changes.

Feature planning lives in `docs/features/FEATURE_TRACKER.md` and `F-NNN.md` files. Bugs live in `docs/bugs/BUG_TRACKER.md` and future `B-NNN.md` files. Update the relevant tracker and document when status or validation plans change.

Future automated tests should map back to acceptance tests. Name tests around behavior, such as `player-view-read-only` or `gm-player-state-sync`.

Classify work before implementation: new capabilities are features, broken or
unsafe promised behavior is a bug, and behavior-preserving internal improvements
are engineering maintenance. Follow the corresponding workflow in
`docs/ai-harness.md` and keep its tracker current.

## Commit & Pull Request Guidelines

The Git history only contains an initial commit, so no project-specific commit convention is established yet. Use short, imperative commit messages, for example:

```text
Add documentation harness
Define local connectivity acceptance tests
```

Pull requests should include a brief summary, files changed, validation performed, and any roadmap or decision updates. UI changes should include screenshots once the app exists.

## Agent-Specific Instructions

Future AI sessions must read the docs before editing. Do not expand MVP scope without updating `docs/roadmap.md`, `docs/features/`, `docs/acceptance-tests.md`, and, for major changes, `docs/decisions/`. Track defects in `docs/bugs/`.

Track behavior-preserving refactors, test hygiene, diagnostics, and maintenance
in `docs/engineering/`; do not present them as product features. Reclassify work
when investigation shows it belongs in a different tracker.

Feature work must follow the mandatory subagent SDLC in `docs/decisions/decision-004-mandatory-subagent-sdlc.md`. Keep changes small, prefer simple browser-first implementation, and preserve the core constraint: this is a local fog-of-war display tool, not a full VTT.

When feature work changes commands, setup, validation steps, user-visible behavior, project status, or contributor workflow, sweep `README.md` during the docs and tracker review. Update it when it no longer matches the current workflow, or explicitly note that no README change was needed.
