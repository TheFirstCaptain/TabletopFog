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

- Keep Status consistent with Phase: `Proposed` maps to `Proposed`, `Done` maps
  to `Complete`, `Blocked` and `Deferred` use their matching status, and every
  other active phase maps to `Active`.
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
- Track behavior-preserving internal work in `docs/engineering/` rather than as a
  product feature.

## Tracker

| ID | Title | Status | Phase | Feature Doc | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Documentation Harness and Repo Structure | Complete | Done | [F-001.md](./F-001.md) | 2026-06-13 | Initial docs, acceptance tests, decisions, AI harness, and contributor guide created. |
| F-002 | Local Connectivity Spike | Complete | Done | [F-002.md](./F-002.md) | 2026-06-14 | Minimal HTTPS Express/Socket.IO counter sync is implemented; Chromebook host to iPad player LAN path validated with ChromeOS Linux port forwarding. |
| F-003 | Streamlined Local Startup and Chromebook Validation | Complete | Done | [F-003.md](./F-003.md) | 2026-06-17 | `npm run local` implemented and validated on MacBook/iPhone, MacBook/iPad, and Chromebook-host paths; Chromebook stale port forwarding workaround documented. |
| F-004 | Campaign and Map Library | Active | Validating | [F-004.md](./F-004.md) | 2026-06-19 | Implemented local campaign library, map management, read-only active map display, and automated tests; physical iPad/Chromebook validation remains. |
| F-005 | Static Active Map Display Polish | Proposed | Proposed | [F-005.md](./F-005.md) | 2026-06-19 | Harden F-004's minimal active-map display with better scaling, refresh/reconnect behavior, and display-state polish. |
| F-006 | Manual Fog of War | Proposed | Proposed | [F-006.md](./F-006.md) | 2026-06-19 | Maps start visible; GM adds fog to hide areas and removes fog to reveal them. |
| F-007 | Save and Load Campaign State | Proposed | Proposed | [F-007.md](./F-007.md) | 2026-06-19 | Complete persistence with per-map fog state and reload behavior after F-004's campaign/map metadata persistence. |
| F-008 | Table Quality-of-Life Improvements | Proposed | Proposed | [F-008.md](./F-008.md) | 2026-06-19 | Better fog brush, undo, reset, fullscreen player view, player URL sharing, and related table polish. |
| F-009 | Engineering Quality Gates | Active | Clarifying | [F-009.md](./F-009.md) | 2026-06-20 | Umbrella for local checks, AI harness compliance, CI enforcement, and browser workflow coverage. |
| F-009A | Local Quality Command and Baseline Enforcement | Complete | Done | [F-009A.md](./F-009A.md) | 2026-06-20 | Authoritative local quality command, module ratchet, coverage floors, lint/format checks, and audit gate completed. |
| F-009B | AI Harness Compliance and Review Evidence | Complete | Done | [F-009B.md](./F-009B.md) | 2026-06-20 | Phase-aware evidence, review findings, closed legacy baseline, and local quality enforcement completed and clean-install validated. |
| F-009C | Continuous Integration Enforcement | Complete | Done | [F-009C.md](./F-009C.md) | 2026-06-20 | GitHub Actions matrix, contract tests, independent reviews, local quality, and hosted green checks completed. |
| F-009D | Browser Workflow Coverage | Proposed | Proposed | [F-009D.md](./F-009D.md) | 2026-06-20 | Characterize current GM/player browser workflows before E-003 and display features. |
