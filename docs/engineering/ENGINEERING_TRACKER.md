# Engineering Maintenance Tracker

Use this tracker for behavior-preserving refactors, test hygiene, diagnostics,
and maintainability work. Product capabilities belong in `docs/features/` and
broken promised behavior belongs in `docs/bugs/`.

## Statuses

- `Proposed`: The maintenance need is recorded but not scheduled.
- `Planned`: Boundaries and validation are defined.
- `Active`: Work is in progress.
- `Validating`: Behavior-preservation checks are in progress.
- `Done`: Work is complete and validated.
- `Blocked`: Work cannot continue without input or an external change.
- `Deferred`: Work is intentionally postponed.

## Priorities

- `P1`: Required before the next dependent feature or broad implementation work.
- `P2`: Important maintainability work that should be scheduled near related
  feature work.
- `P3`: Useful cleanup that can wait without materially increasing current risk.

## Tracking Conventions

- Use one record for one independently verifiable maintenance outcome.
- State the behavior that must remain unchanged.
- Do not use maintenance work to introduce new product behavior.
- Convert discovered broken behavior into a bug and link the records.
- Convert materially new capabilities into a feature and link the records.
- Prefer incremental extraction over repository-wide refactors.
- Update affected tests and documentation when module boundaries or contributor
  workflows change.

## Tracker

| ID | Title | Status | Priority | Engineering Doc | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| E-001 | Clean Up Test Temporary Directories | Done | P3 | [E-001.md](./E-001.md) | 2026-06-20 | Shared per-test recursive teardown covers every temporary-directory test and passed full quality validation. |
| E-002 | Separate Campaign Storage Responsibilities | Proposed | P2 | [E-002.md](./E-002.md) | 2026-06-20 | Incrementally separate schema, validation, serialization, and filesystem operations before persistence grows. |
| E-003 | Separate GM Client Responsibilities | Done | P1 | [E-003.md](./E-003.md) | 2026-06-21 | Six focused GM modules preserve all characterized behavior and passed the 20-module ratchet, 75 Node tests, 4 Chromium workflows, and full quality. |
| E-004 | Separate Server Transport Responsibilities | Proposed | P2 | [E-004.md](./E-004.md) | 2026-06-20 | Separate HTTP routing, role projection, Socket.IO coordination, and startup concerns. |
| E-005 | Establish Module Responsibility and Growth Baselines | Done | P1 | [E-005.md](./E-005.md) | 2026-06-20 | Fifteen-module responsibility inventory and strict bidirectional ratchet are implemented, reviewed, and validated. |
| E-006 | Harden Test Fixtures and Failure-Path Coverage | Done | P1 | [E-006.md](./E-006.md) | 2026-06-20 | Representative fixtures, boundary matrices, partial-state assertions, and test guidance passed full quality validation. |
| E-007 | Stabilize Browser Reconnect Timing | Done | P2 | [E-007.md](./E-007.md) | 2026-06-21 | Scoped reconnect timing preserves all outcomes and passes isolation, the six-test Chromium suite, and full quality. |
