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
| F-004 | Campaign and Map Library | Complete | Done | [F-004.md](./F-004.md) | 2026-06-25 | Implemented local campaign library, map management, read-only active map display, automated tests, and physical Chromebook/iPad validation. |
| F-004A | Fantasy Visual Theme | Complete | Done | [F-004A.md](./F-004A.md) | 2026-06-21 | Pinned local EB Garamond, parchment theme, dark stage, focus/contrast checks, B-007 fix, and E-007 test stabilization passed all reviews and full quality. |
| F-005 | Static Active Map Display Polish | Complete | Done | [F-005.md](./F-005.md) | 2026-06-25 | Shared canvas rendering, independent player zoom and pan, display recovery, full automated validation, and physical Chromebook/iPad validation completed. |
| F-005A | Campaign Landing Page Polish | Complete | Done | [F-005A.md](./F-005A.md) | 2026-06-25 | Emoji campaign cards, editable descriptions, GM-only metadata persistence, diagnostics, and Chromium validation are complete. |
| F-005B | Encounter Card Gallery and Workspace Entry | Complete | Done | [F-005B.md](./F-005B.md) | 2026-06-25 | Encounter cards, GM-local workspace entry, explicit card-level show-to-players behavior, and Chromium validation are complete. |
| F-005C | Encounter Workspace Shell | Complete | Done | [F-005C.md](./F-005C.md) | 2026-06-25 | Focused GM encounter workspace shell, workspace show action, gallery navigation, and Chromium validation are complete. |
| F-005D | Navigation Simplification | Complete | Done | [F-005D.md](./F-005D.md) | 2026-06-25 | Informational breadcrumbs, hidden normal data-root UI, standardized non-root Back actions, and Chromium validation are complete. |
| F-005E | Campaign Card Presentation | Complete | Done | [F-005E.md](./F-005E.md) | 2026-06-28 | Campaign card presentation polish, focused Chromium coverage, independent reviews, and full quality validation are complete. |
| F-005F | Encounter Gallery Presentation | Complete | Done | [F-005F.md](./F-005F.md) | 2026-06-28 | Encounter gallery presentation polish, B-008 follow-up validation, independent reviews, and full quality validation are complete. |
| F-005G | Encounter Workspace Layout | Complete | Done | [F-005G.md](./F-005G.md) | 2026-06-28 | Encounter workspace layout, Chromebook/narrow coverage, independent reviews, and full quality validation are complete. |
| F-005H | Manage Mode | Complete | Done | [F-005H.md](./F-005H.md) | 2026-06-28 | Encounter-gallery Manage Mode, Normal Mode hiding of admin controls, independent reviews, and full quality validation are complete. |
| F-005K | Clear Shown Encounter | Complete | Done | [F-005K.md](./F-005K.md) | 2026-06-28 | Clear shown encounter, card/workspace clear behavior, independent reviews, and full quality validation are complete. |
| F-005L | Delete Encounters | Complete | Done | [F-005L.md](./F-005L.md) | 2026-06-29 | Permanent encounter deletion, selected-prep allowance, shown-encounter guard, Player Display preservation, independent reviews, and full quality validation are complete. |
| F-005M | Delete Campaigns | Complete | Done | [F-005M.md](./F-005M.md) | 2026-06-29 | Empty campaign deletion with confirmation, non-empty guards, Player Display preservation, independent reviews, and full quality validation are complete. |
| F-005I | Design Language Compliance Review | Complete | Done | [F-005I.md](./F-005I.md) | 2026-06-29 | Completed documentation-only design-language compliance review, recorded follow-up recommendations, and preserved the no-implementation boundary. |
| F-005J | Final UI Polish | Complete | Done | [F-005J.md](./F-005J.md) | 2026-06-29 | Static CSS and copy polish, no-animation guard, focused Chromium coverage, independent reviews, and full quality validation are complete. |
| F-005N | Encounter Workspace Map Density | Complete | Done | [F-005N.md](./F-005N.md) | 2026-06-30 | Compact Encounter Workspace header, map-dominant first viewport, fixed quiet future-tools area, long-name overflow coverage, independent reviews, and full quality validation are complete. |
| F-005O | One-Line GM App Header | Complete | Done | [F-005O.md](./F-005O.md) | 2026-06-30 | One-line GM app header with TabletopFog, breadcrumb, right-aligned connection state, Chromebook/reconnect coverage, independent reviews, and full quality validation are complete. |
| F-005P | Campaign Encounter Gallery Simplification | Complete | Done | [F-005P.md](./F-005P.md) | 2026-06-30 | Removed Manage Mode and embedded Campaign-page workspace, added compact upper-right Add Encounter, quiet direct card controls, independent reviews, and full quality validation. |
| F-006 | Manual Fog of War | Complete | Done | [F-006.md](./F-006.md) | 2026-07-02 | Manual fog V1 is complete with in-memory ordered rectangle hide/reveal operations, Clear Fog, GM-local zoom, grid, panning, and validated Player Display isolation. |
| F-006A | GM Map Zoom and Grid Calibration | Complete | Done | [F-006A.md](./F-006A.md) | 2026-07-01 | GM-only, non-persistent fixed workspace grid with per-encounter GM-tab state, map-image zoom underneath, independent reviews, and full quality validation are complete. |
| F-006B | Fog State and Rendering Foundation | Complete | Done | [F-006B.md](./F-006B.md) | 2026-07-01 | In-memory per-encounter fog operation state, role-specific canvas rendering, projection filtering, lifecycle pruning, independent reviews, and full quality validation are complete. |
| F-006C | Rectangle Hide Tool | Complete | Done | [F-006C.md](./F-006C.md) | 2026-07-01 | GM-only rectangle Hide drawing, server-side append, renderer-owned geometry, grid/input arbitration, independent reviews, and full quality validation are complete. |
| F-006D | Rectangle Reveal Tool | Complete | Done | [F-006D.md](./F-006D.md) | 2026-07-02 | Separate explicit Reveal button, ordered in-memory reveal operations, pointer-driven coverage, independent reviews, and full quality validation are complete. |
| F-006E | Clear Fog | Complete | Done | [F-006E.md](./F-006E.md) | 2026-07-02 | Always-visible confirmed Clear Fog control, selected-encounter clearing, shown/unshown sync behavior, reviews, and full quality validation are complete. |
| F-006F | Fog Tool Polish and Validation | Complete | Done | [F-006F.md](./F-006F.md) | 2026-07-02 | GM-local zoomed map panning, keyboard pan, fog/grid arbitration, locked-grid anchoring, responsive coverage, docs, and F-006 umbrella completion passed final quality. |
| F-007 | Save and Load Campaign State | Proposed | Proposed | [F-007.md](./F-007.md) | 2026-07-03 | Split into focused child features for fog persistence, shown-to-players restore, recovery validation, and optional diagnostics. |
| F-007A | Persist Per-Encounter Fog State | Complete | Done | [F-007A.md](./F-007A.md) | 2026-07-03 | Autosaves ordered fog operations per encounter, hydrates persisted fog on campaign open, preserves route/UI terminology, and passed full quality. |
| F-007B | Restore Shown-to-Players State | Proposed | Proposed | [F-007B.md](./F-007B.md) | 2026-07-03 | Restore saved shown-to-players encounter and fog after campaign reopen or server restart. |
| F-007C | Persistence Validation and Recovery States | Proposed | Proposed | [F-007C.md](./F-007C.md) | 2026-07-03 | Harden malformed fog, missing map asset, and storage-format recovery behavior. |
| F-007D | Persistence Status and Diagnostics | Proposed | Proposed | [F-007D.md](./F-007D.md) | 2026-07-03 | Optional quiet GM-facing persistence status or diagnostics if earlier F-007 slices show a need. |
| F-008 | Table Quality-of-Life Improvements | Proposed | Proposed | [F-008.md](./F-008.md) | 2026-06-19 | Better fog brush, undo, reset, fullscreen player view, player URL sharing, and related table polish. |
| F-009 | Engineering Quality Gates | Complete | Done | [F-009.md](./F-009.md) | 2026-06-21 | Local policy, harness enforcement, CI matrix, and Chromium browser workflow coverage are complete. |
| F-009A | Local Quality Command and Baseline Enforcement | Complete | Done | [F-009A.md](./F-009A.md) | 2026-06-20 | Authoritative local quality command, module ratchet, coverage floors, lint/format checks, and audit gate completed. |
| F-009B | AI Harness Compliance and Review Evidence | Complete | Done | [F-009B.md](./F-009B.md) | 2026-06-20 | Phase-aware evidence, review findings, closed legacy baseline, and local quality enforcement completed and clean-install validated. |
| F-009C | Continuous Integration Enforcement | Complete | Done | [F-009C.md](./F-009C.md) | 2026-06-20 | GitHub Actions matrix, contract tests, independent reviews, local quality, and hosted green checks completed. |
| F-009D | Browser Workflow Coverage | Complete | Done | [F-009D.md](./F-009D.md) | 2026-06-21 | Four Chromium workflow groups, deterministic cleanup, quality/CI integration, and B-005/B-006 fixes passed all reviews and quality. |
