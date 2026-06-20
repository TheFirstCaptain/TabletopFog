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
- `docs/engineering/ENGINEERING_TRACKER.md`
- Relevant files in `docs/engineering/`
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
- Final-diff review after implementation and test changes are complete.
- Main-agent integration and final validation.

The main agent owns the final result. Subagent findings must be reconciled against the vision, architecture, roadmap, acceptance tests, decisions, bugs, and feature docs before changes are accepted.

## Harness Version 1 Evidence

Every non-legacy feature must use the exact structured sections in
`docs/features/FEATURE_TEMPLATE.md` before leaving `Proposed`. Evidence is
cumulative by tracker phase:

- `Clarifying`: clarification.
- `Planned` or `Approved`: clarification, architecture, implementation, test,
  and UX reviews plus the review-scope checklist.
- `Building` or `Validating`: the planning evidence plus Coding and TDD.
- `Reviewing`: all prior evidence plus code, docs/tracker, and final-diff review.
- `Done`: all stages plus final validation and governed findings.
- `Blocked` or `Deferred`: clarification plus explicit blocker or deferral
  evidence.

Required independent reviews cannot use `/root` as the reviewer. Use a
subagent identity such as `/root/code_review` or a human identity such as
`human:user`. If independent review is unavailable, move the feature to
`Blocked`; the main agent cannot self-waive the requirement.

Material findings use the exact table in the feature template. Critical and
high findings must be fixed. Medium findings must be fixed or user-approved as
accepted/deferred with an existing B-, E-, or decision follow-up, a non-expired
ISO review date, and residual risk. Low findings require a disposition. Use the
exact sentence `No material findings.` only when none exist.

Run `npm run harness:check` for a direct compliance check. The authoritative
`npm run quality` command runs it automatically. The only legacy exceptions are
the fixed records in `quality/harness-baseline.json`; adding another legacy ID
is rejected by policy code.

## Classify Follow-Up Work

After a feature is complete, use child features such as `F-004A` for follow-up tweaks that remain inside the parent feature's product capability and are distinct enough to track, validate, or review separately.

Track broken promised behavior as a bug in `docs/bugs/` instead of as a child feature. Use a new top-level feature when the work adds a new product capability outside the completed parent feature's scope.

Before implementation, classify the change using
`docs/decisions/decision-008-change-classification-and-maintenance-workflow.md`:

- Use a feature for a new product, developer, tooling, or workflow capability.
- Use a bug for implemented or promised behavior that is broken, unsafe, or
  materially misleading.
- Use engineering maintenance for behavior-preserving structure, test hygiene,
  diagnostics, or maintainability work.

## Mandatory Bug Workflow

When fixing a bug:

1. Read `docs/bugs/BUG_TRACKER.md` and the relevant `B-NNN.md` document.
2. Reproduce or otherwise confirm the issue and record the evidence.
3. Add a failing regression test where practical.
4. Make the smallest corrective change without adding unrelated capability.
5. Review the fix for regression, security, data-integrity, and documentation
   impact.
6. Run relevant automated and manual validation.
7. Update the bug document, bug tracker, related feature documents, and other
   affected documentation before marking the bug resolved.

If the correction requires a materially new capability, stop and create or link
a feature rather than expanding the bug silently.

## Mandatory Engineering Maintenance Workflow

When performing engineering maintenance:

1. Read `docs/engineering/ENGINEERING_TRACKER.md` and the relevant `E-NNN.md`
   document.
2. State the observable behavior that must remain unchanged.
3. Define narrow scope, module boundaries, and validation before editing.
4. Prefer incremental changes over repository-wide rewrites.
5. Run the full relevant test suite and targeted behavior-preservation checks.
6. Review for accidental product, protocol, storage, or workflow changes.
7. Update the engineering tracker and affected documentation before marking the
   work done.

If maintenance exposes broken promised behavior, create or link a bug. If it
introduces new capability, create or link a feature.

## Keep Scope Small

Make the smallest useful change for the current milestone.

Do not expand project scope without also updating:

- `README.md` if commands, setup, current status, validation workflow, or user-facing behavior changed
- `docs/roadmap.md`
- `docs/features/FEATURE_TRACKER.md`
- The relevant feature document in `docs/features/`
- `docs/bugs/BUG_TRACKER.md` if the work discovers or fixes a defect
- `docs/engineering/ENGINEERING_TRACKER.md` if the work creates, changes, or
  completes behavior-preserving maintenance
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

- Run `npm run quality` as the authoritative completion check for code or
  tooling changes. Documentation-only work may use the relevant documentation
  and diff checks.
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
