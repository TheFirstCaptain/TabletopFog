# AI Harness

This document defines how future Codex or AI-assisted sessions should work on TabletopFog.

## Start Every Session by Reading Docs

Before making code or documentation changes, read:

- `docs/vision.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/acceptance-tests.md`
- `docs/features/FEATURE_TRACKER.md`
- Relevant files in `docs/features/`
- `docs/bugs/BUG_TRACKER.md`
- Relevant files in `docs/bugs/`
- Relevant files in `docs/decisions/`

Use these documents as the source of truth for scope and direction.

## Keep Scope Small

Make the smallest useful change for the current milestone.

Do not expand project scope without also updating:

- `docs/roadmap.md`
- `docs/features/FEATURE_TRACKER.md`
- The relevant feature document in `docs/features/`
- `docs/bugs/BUG_TRACKER.md` if the work discovers or fixes a defect
- `docs/acceptance-tests.md`
- A decision record in `docs/decisions/` if the change affects architecture, product boundaries, or long-term direction.

## Prefer Simple Implementation

Default to simple, browser-first choices:

- Local Node.js server.
- Express for serving pages.
- Socket.IO or WebSocket for live updates.
- HTML Canvas for map and fog rendering.
- Plain HTML, CSS, and JavaScript unless there is a clear reason for more.

Avoid adding a frontend framework, build system, database, auth system, or cloud dependency unless a documented decision explains why.

## Protect Product Boundaries

For the MVP, do not add:

- Tokens.
- Initiative tracker.
- Character sheets.
- Dice roller.
- Rules automation.
- NPC tracking.
- Login/auth.
- Cloud hosting dependency.

If a future change touches one of these areas, stop and update roadmap and decisions first.

## Update Acceptance Criteria with Features

When adding or changing behavior, update `docs/acceptance-tests.md` with human-readable validation steps.

Also update the relevant feature document in `docs/features/` with acceptance notes, affected systems, validation plan, and current status.

If the change fixes a defect, update `docs/bugs/BUG_TRACKER.md` and the relevant bug document in `docs/bugs/`.

Acceptance tests should describe:

- The setup.
- The user action.
- The expected result.
- Any known environmental assumptions, such as same-Wi-Fi access.

## Record Major Decisions

Create or update files in `docs/decisions/` for major decisions.

Use this pattern:

- Context.
- Decision.
- Consequences.
- Alternatives considered.

Decision records should be short but specific enough for a future AI session to understand why the project chose a path.

## Validate Before Finishing

Before ending a coding session:

- Run available validation commands.
- If no automated tests exist yet, perform the relevant human-readable checks where possible.
- Report what was validated.
- Report anything that could not be validated.

## Summarize Changes

At the end of each session, summarize:

- Files changed.
- Behavior changed.
- Validation performed.
- Follow-up recommendations.

Keep summaries factual and concise.
