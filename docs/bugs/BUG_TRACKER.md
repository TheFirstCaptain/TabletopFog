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
| B-004 | Invalid Campaign Metadata Is Silently Hidden | Resolved | P2 | [B-004.md](./B-004.md) | 2026-06-20 | Valid campaigns remain visible and malformed folders produce safe, non-destructive GM recovery diagnostics. |
| B-005 | Hidden Player Image Remains Visible After Load Failure | Resolved | P2 | [B-005.md](./B-005.md) | 2026-06-21 | Semantic hidden CSS fix passes Chromium image-error regression and full quality. |
| B-006 | Harness Repository Test Rejects Current-Dated Evidence | Resolved | P2 | [B-006.md](./B-006.md) | 2026-06-21 | Live-repository validation uses the current clock and passes full quality. |
| B-007 | Data Root Path Overflows Narrow GM Layout | Resolved | P3 | [B-007.md](./B-007.md) | 2026-06-21 | Scoped path wrapping passes the 390 px Chromium regression and full quality. |
| B-008 | Campaign Details Edit Cannot Change Campaign Name | Resolved | P3 | [B-008.md](./B-008.md) | 2026-06-28 | Campaign display-name editing now uses the existing GM-only campaign details flow without renaming local folders. |
| B-009 | Encounter Workspace Narrows After Opening Encounter | Resolved | P3 | [B-009.md](./B-009.md) | 2026-06-28 | Focused workspace now spans the campaign content area after opening an encounter, with Chromium regression coverage. |
