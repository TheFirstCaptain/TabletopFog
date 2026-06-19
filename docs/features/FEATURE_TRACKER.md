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
- Use child features, such as `F-004A`, for follow-up tweaks that remain inside a completed parent feature's product capability and are distinct enough to track, validate, or review separately.
- Track broken promised behavior as a bug in `docs/bugs/` instead of as a child feature.
- Use a new top-level feature when the work adds a new product capability outside the parent feature's scope.
- Keep small implementation steps inside the feature document instead of adding tracker rows.
- Prefer outcome-oriented tracker entries over task lists.
- For feature work, follow the mandatory SDLC subagent workflow in `docs/decisions/decision-004-mandatory-subagent-sdlc.md`.
- Update `docs/acceptance-tests.md` when feature behavior changes.
- Record major architecture or scope decisions in `docs/decisions/`.

## Tracker

| ID | Title | Status | Phase | Feature Doc | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Documentation Harness and Repo Structure | Complete | Done | [F-001.md](./F-001.md) | 2026-06-13 | Initial docs, acceptance tests, decisions, AI harness, and contributor guide created. |
| F-002 | Local Connectivity Spike | Complete | Done | [F-002.md](./F-002.md) | 2026-06-14 | Minimal HTTPS Express/Socket.IO counter sync is implemented; Chromebook host to iPad player LAN path validated with ChromeOS Linux port forwarding. |
| F-003 | Streamlined Local Startup and Chromebook Validation | Complete | Done | [F-003.md](./F-003.md) | 2026-06-17 | `npm run local` implemented and validated on MacBook/iPhone, MacBook/iPad, and Chromebook-host paths; Chromebook stale port forwarding workaround documented. |
| F-004 | Campaign and Map Library | Proposed | Proposed | [F-004.md](./F-004.md) | 2026-06-19 | Create/open local campaign folders and manage multiple ordered maps inside a campaign. |
| F-005 | Static Active Map Display | Proposed | Proposed | [F-005.md](./F-005.md) | 2026-06-19 | Display the selected active campaign map consistently on GM/player views. |
| F-006 | Manual Fog of War | Proposed | Proposed | [F-006.md](./F-006.md) | 2026-06-19 | Maps start visible; GM adds fog to hide areas and removes fog to reveal them. |
| F-007 | Save and Load Campaign State | Proposed | Proposed | [F-007.md](./F-007.md) | 2026-06-19 | Persist local campaigns, maps, ordering, active map, and per-map fog state. |
| F-008 | Table Quality-of-Life Improvements | Proposed | Proposed | [F-008.md](./F-008.md) | 2026-06-19 | Better fog brush, undo, reset, fullscreen player view, player URL sharing, and related table polish. |
