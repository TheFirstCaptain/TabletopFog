# Bug Tracker

Use this tracker for known defects, regressions, build failures, browser/device compatibility issues, local-network issues, and scope blockers.

## Statuses

- `Open`: Confirmed or suspected issue that has not been fixed.
- `Investigating`: Reproduction, scope, or cause is being researched.
- `Fixing`: A fix is in progress.
- `Validating`: The fix is being tested.
- `Resolved`: Fix is complete and validated.
- `Deferred`: Issue is accepted for later work.
- `Won't Fix`: Issue is intentionally not being addressed.

## Priorities

- `P0`: Blocks all useful development or prevents the app from running.
- `P1`: Blocks a major MVP workflow, such as local connectivity or player display.
- `P2`: Important but does not block broad progress.
- `P3`: Minor, cosmetic, or documentation-only.

## Tracking Conventions

- Use one bug entry for one reproducible defect, build failure, compatibility issue, or blocker.
- Use a blocker entry when an issue affects multiple future features and cannot be cleanly assigned to one feature.
- Keep investigation notes in linked bug documents instead of expanding the tracker table.
- Link bugs to affected feature docs when a defect blocks or is found during feature work.
- Prefer `Deferred` over deleting known issues that are intentionally postponed.
- Record same-Wi-Fi, device, browser, and OS details for connectivity or display bugs.
- Before fixing a bug, reproduce or otherwise confirm it, record evidence in the
  bug document, add a failing regression test where practical, make the smallest
  corrective change, review the result, and run the documented validation.
- If investigation shows the behavior is not broken, reclassify the work as a
  feature or engineering maintenance item and cross-link the records.

## Tracker

| ID | Title | Status | Priority | Bug Doc | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| B-001 | WebSocket Dependency Permits Memory-Exhaustion DoS | Resolved | P2 | [B-001.md](./B-001.md) | 2026-06-20 | Patched transitive dependencies; `npm audit` reports zero vulnerabilities. |
| B-002 | Campaign Reads Can Destructively Normalize Metadata | Resolved | P2 | [B-002.md](./B-002.md) | 2026-06-20 | Reads are non-mutating and later writes preserve unrecognized metadata. |
| B-003 | Map Upload Accepts Invalid Image Data | Resolved | P2 | [B-003.md](./B-003.md) | 2026-06-20 | Supported image signatures and matching upload metadata are validated before persistence. |
| B-004 | Invalid Campaign Metadata Is Silently Hidden | Open | P2 | [B-004.md](./B-004.md) | 2026-06-20 | Invalid campaigns are omitted without a GM-visible diagnostic. |
