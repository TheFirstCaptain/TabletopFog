# AI Harness

This document defines how future Codex or AI-assisted sessions should work on TabletopFog.

## Start Every Session by Reading Docs

Before making code or documentation changes, read:

- `docs/vision.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/acceptance-tests.md`
- `docs/development.md`
- `docs/definition-of-done.md`
- `docs/network-troubleshooting.md`
- `docs/features/FEATURE_TRACKER.md`
- Relevant files in `docs/features/`
- `docs/bugs/BUG_TRACKER.md`
- Relevant files in `docs/bugs/`
- `docs/subagent-output.md`
- Relevant files in `docs/decisions/`

Use these documents as the source of truth for scope and direction.

## Mandatory Feature Workflow

When the user asks to start or continue a feature, including prompts such as "let's do the next feature," the main agent must:

1. Read `docs/features/FEATURE_TRACKER.md`.
2. Select the next eligible feature or confirm the requested feature.
3. Read the relevant `docs/features/F-NNN.md`.
4. Ask clarification questions before implementation.
5. Record the answers in the feature document.
6. Run the mandatory SDLC subagent workflow from `docs/decisions/decision-004-mandatory-subagent-sdlc.md`.
7. Integrate the work, run validation, update docs and trackers, and summarize the outcome.

All of these stages are mandatory for feature work:

- Clarification.
- Architecture review.
- Implementation design.
- Test and validation design.
- UX and workflow review.
- Coding with Red/Green TDD where practical.
- Code review.
- Docs and tracker review.
- Main-agent integration and final validation.

The main agent owns the final result. Subagent findings must be reconciled against the vision, architecture, roadmap, acceptance tests, decisions, bugs, and feature docs before changes are accepted.

## Classify Follow-Up Work

After a feature is complete, use child features such as `F-004A` for follow-up tweaks that remain inside the parent feature's product capability and are distinct enough to track, validate, or review separately.

Track broken promised behavior as a bug in `docs/bugs/` instead of as a child feature. Use a new top-level feature when the work adds a new product capability outside the completed parent feature's scope.

## Keep Scope Small

Make the smallest useful change for the current milestone.

Do not expand project scope without also updating:

- `README.md` if commands, setup, current status, validation workflow, or user-facing behavior changed
- `docs/roadmap.md`
- `docs/features/FEATURE_TRACKER.md`
- The relevant feature document in `docs/features/`
- `docs/bugs/BUG_TRACKER.md` if the work discovers or fixes a defect
- `docs/acceptance-tests.md`
- `docs/development.md` if commands, runtime assumptions, ports, or certificate setup change
- `docs/network-troubleshooting.md` if local connectivity setup or failure modes change
- A decision record in `docs/decisions/` if the change affects architecture, product boundaries, or long-term direction.

## Prefer Simple Implementation

Default to simple, browser-first choices:

- Local Node.js server.
- Express for serving pages.
- Socket.IO for live updates.
- HTTPS for local serving.
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
- Session or campaign notes.
- Dynamic lighting.
- Login/auth.
- Cloud hosting dependency.

If a future change touches one of these areas, stop and update roadmap and decisions first.

## Update Acceptance Criteria with Features

When adding or changing behavior, update `docs/acceptance-tests.md` with human-readable validation steps.

Also update the relevant feature document in `docs/features/` with acceptance notes, affected systems, validation plan, and current status.

During docs and tracker review, sweep `README.md` for stale setup commands, validation commands, current-status language, and user-facing workflow notes. Update it when needed; if it remains accurate, record that no README change was necessary in the feature document or final handoff.

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
- Check `docs/definition-of-done.md` before marking a feature `Done`.
- Report what was validated.
- Report anything that could not be validated.

## Summarize Changes

At the end of each session, summarize:

- Files changed.
- Behavior changed.
- Validation performed.
- Follow-up recommendations.

Keep summaries factual and concise.
