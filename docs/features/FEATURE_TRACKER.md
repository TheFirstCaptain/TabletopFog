# Feature Tracker

Use this tracker to preserve feature state across sessions and agent handoffs. Keep implementation details in feature documents, not in this table.

## Phases

- `Proposed`: Feature exists as a plain-language outcome.
- `Clarifying`: Requirements, constraints, and open questions are being gathered.
- `Planned`: Implementation approach is documented for review.
- `Approved`: Plan is approved for implementation.
- `Building`: Implementation is in progress.
- `Validating`: Tests, checks, or manual verification are in progress.
- `Reviewing`: Review findings are being gathered or addressed.
- `Done`: Feature is complete and validated.
- `Blocked`: Work cannot continue without input or an external change.
- `Deferred`: Feature is intentionally paused.

## Tracking Conventions

- Use an umbrella feature for a milestone with multiple related workstreams.
- Use child features, such as `F-002A`, only when the work can be delegated, validated, or completed independently.
- Keep small implementation steps inside the feature document instead of adding tracker rows.
- Prefer outcome-oriented tracker entries over task lists.
- For feature work, follow the mandatory SDLC subagent workflow in `docs/decisions/decision-004-mandatory-subagent-sdlc.md`.
- Update `docs/acceptance-tests.md` when feature behavior changes.
- Record major architecture or scope decisions in `docs/decisions/`.

## Tracker

| ID | Title | Status | Phase | Feature Doc | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Documentation Harness and Repo Structure | Complete | Done | [F-001.md](./F-001.md) | 2026-06-13 | Initial docs, acceptance tests, decisions, AI harness, and contributor guide created. |
| F-002 | Local Connectivity Spike | Clarifying | Clarifying | [F-002.md](./F-002.md) | 2026-06-13 | Primary early validation will use a MacBook Pro host with iPhone/iPad clients; intended-use validation will repeat with Chromebook host and iPad client. |
| F-003 | Static Map Display | Proposed | Proposed | [F-003.md](./F-003.md) | 2026-06-13 | Load or choose a map and display it consistently on GM/player views. |
| F-004 | Basic Fog of War | Proposed | Proposed | [F-004.md](./F-004.md) | 2026-06-13 | Full fog layer and simple GM reveal shapes, with player seeing only revealed areas. |
| F-005 | Save and Load State | Proposed | Proposed | [F-005.md](./F-005.md) | 2026-06-13 | Persist current map and fog state locally, then reload a previous session. |
| F-006 | Table Quality-of-Life Improvements | Proposed | Proposed | [F-006.md](./F-006.md) | 2026-06-13 | Better reveal brush, undo, reset, fullscreen player view, and shareable player URL. |
