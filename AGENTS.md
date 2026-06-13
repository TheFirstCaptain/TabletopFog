# Repository Guidelines

## Project Structure & Module Organization

TabletopFog is currently in the documentation and validation-harness phase. No application source code exists yet.

- `docs/vision.md`: product purpose, target users, MVP boundaries.
- `docs/architecture.md`: recommended technical direction and view responsibilities.
- `docs/roadmap.md`: milestone plan and explicit out-of-MVP ideas.
- `docs/features/`: feature tracker, feature template, and milestone feature briefs.
- `docs/bugs/`: bug tracker and bug template.
- `docs/acceptance-tests.md`: human-readable validation tests.
- `docs/ai-harness.md`: rules for future AI-assisted development.
- `docs/decisions/`: architecture and product decision records.

When app code begins, prefer a small browser-first structure such as `server/`, `public/`, and `tests/`.

## Build, Test, and Development Commands

No build system is present yet. Current validation commands are documentation-oriented:

```sh
rg --files
git status --short
```

Use `rg --files` to confirm files exist. Use `git status --short` before and after changes.

When Milestone 1 starts, add local server commands here, for example:

```sh
npm install
npm run dev
npm test
```

## Coding Style & Naming Conventions

Use concise Markdown with descriptive headings. Keep docs specific to this project.

For decision records, use the naming pattern:

```text
docs/decisions/decision-NNN-short-topic.md
```

Use ASCII unless a file already requires otherwise. For future JavaScript, prefer plain HTML/CSS/JS first, small modules, and names that describe user-facing behavior.

## Testing Guidelines

Acceptance tests are currently human-readable and live in `docs/acceptance-tests.md`. Update that file whenever behavior or milestone scope changes.

Feature planning lives in `docs/features/FEATURE_TRACKER.md` and `F-NNN.md` files. Bugs live in `docs/bugs/BUG_TRACKER.md` and future `B-NNN.md` files. Update the relevant tracker and document when status, acceptance notes, affected systems, or validation plans change.

Future automated tests should map back to acceptance tests. Name tests around behavior, such as `player-view-read-only` or `gm-player-state-sync`.

## Commit & Pull Request Guidelines

The Git history only contains an initial commit, so no project-specific commit convention is established yet. Use short, imperative commit messages, for example:

```text
Add documentation harness
Define local connectivity acceptance tests
```

Pull requests should include a brief summary, files changed, validation performed, and any roadmap or decision updates. UI changes should include screenshots once the app exists.

## Agent-Specific Instructions

Future AI sessions must read the docs before editing. Do not expand MVP scope without updating `docs/roadmap.md`, `docs/features/`, `docs/acceptance-tests.md`, and, for major changes, `docs/decisions/`. Track defects in `docs/bugs/`.

Keep changes small, prefer simple browser-first implementation, and preserve the core constraint: this is a local fog-of-war display tool, not a full VTT.
