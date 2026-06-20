# Definition of Done

Use the relevant checklist before marking a feature done, resolving a bug, or
completing engineering maintenance.

## Required for Every Feature

- Clarification answers are recorded in the feature document.
- Mandatory SDLC agent outputs are recorded or summarized in the feature document.
- Acceptance notes are satisfied or explicitly revised.
- Non-goals were checked for scope creep.
- Relevant automated tests pass, if tests exist.
- `npm run quality` passes for code or tooling changes; documentation-only work
  may use the relevant documentation and diff checks instead.
- Relevant manual validation is performed or documented as not possible.
- `docs/acceptance-tests.md` is updated when user-visible behavior changes.
- `docs/development.md` is updated when commands, runtime assumptions, ports, HTTPS setup, or validation commands change.
- `README.md` has been swept for stale commands, setup steps, current status, and user-facing workflow notes; update it when needed or record that no change was required.
- `docs/bugs/BUG_TRACKER.md` is updated for discovered or fixed defects.
- New major architecture or product decisions are recorded in `docs/decisions/`.
- `docs/features/FEATURE_TRACKER.md` has current status, phase, date, and notes.
- Final handoff summarizes files changed, behavior changed, validation performed, and residual risks.

## Required Before Build-Oriented Features Are Done

- The app starts using documented commands.
- Tests or equivalent validation cover the changed behavior.
- The GM and player roles behave as documented.
- Player view remains read-only.
- HTTPS behavior is validated or any certificate/network failure is documented.

## When Done Is Not Appropriate

Do not mark a feature `Done` if:

- Required validation was skipped without explanation.
- Known blocking bugs are still open.
- The feature expanded MVP scope without roadmap and decision updates.
- Documentation no longer matches behavior.

## Required Before Resolving a Bug

- The issue is reproduced or otherwise confirmed in the bug document.
- `npm run quality` passes when the bug fix changes code or tooling.
- A regression test is added where practical, or the reason it is not practical
  is recorded.
- The fix is limited to the broken behavior or linked to a feature when new
  capability is required.
- Relevant automated and manual validation passes.
- Security, data-integrity, and compatibility effects are reviewed.
- The bug document, bug tracker, related feature documents, and affected user or
  developer documentation are current.

## Required Before Completing Engineering Maintenance

- The engineering document states the behavior being preserved.
- Scope and module boundaries are explicit.
- Relevant automated tests and targeted behavior-preservation checks pass.
- `npm run quality` passes when engineering maintenance changes code or tooling.
- No unintended product, protocol, storage, or workflow changes were introduced.
- Discovered defects or new capabilities are reclassified and linked.
- The engineering tracker and affected documentation are current.
