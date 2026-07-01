# Decision 004: Mandatory Subagent SDLC for Feature Work

## Context

TabletopFog is intended to be developed through AI-assisted feature work. A common user prompt may be as short as "let's do the next feature." Without a structured workflow, an agent could skip clarification, overbuild, miss project boundaries, or fail to update the documentation harness.

## Decision

Feature work must use a mandatory SDLC-style workflow, but the amount of
independent review should be risk-based instead of one-size-fits-all.

The main agent remains accountable for coordination, scope control, integration, validation, and the final handoff. Subagents provide focused review or execution for required stages.

Before a feature leaves `Proposed`, the main agent must classify it into one of
these tiers and record the tier and rationale in the feature document.

### Tier 0: Documentation and Planning

Use for documentation-only planning, tracker cleanup, feature splitting, or
scope clarification that does not change product behavior, code, tests, setup,
commands, or validation policy.

Required workflow:

1. Clarification or rationale.
2. Documentation/tracker update.
3. Main-agent diff review and relevant documentation validation.

Independent subagent review is optional for Tier 0 unless the documentation
changes project policy, architecture, roadmap sequencing, or completion rules.

### Tier 1: Narrow Maintenance or Low-Risk UI

Use for behavior-preserving refactors, test hygiene, diagnostics, copy changes,
or narrow UI polish that does not touch storage, server state, player
projection, sync, security boundaries, rendering semantics, setup commands, or
workflow-critical behavior.

Required workflow:

1. Clarification.
2. Implementation and validation design, which may be recorded together.
3. Coding with focused tests where practical.
4. Independent code review.
5. Docs/tracker review when docs or tracked status change.
6. Main-agent final validation.

### Tier 2: Normal Feature

Use for ordinary product behavior that changes user-visible workflows but does
not materially affect persistence, migrations, server trust boundaries,
read-only player guarantees, map/fog rendering correctness, local-network
runtime, or other high-risk shared contracts.

Required workflow:

1. Clarification.
2. Combined planning review covering architecture, implementation design, test
   and validation design, and UX/workflow.
3. Coding with Red/Green TDD where practical.
4. Independent code review.
5. Docs and tracker review.
6. Final-diff review after implementation and test changes are complete.
7. Main-agent integration and final validation.

The combined planning review may be one independent review if it explicitly
covers architecture, implementation, test, and UX concerns.

### Tier 3: Risky Feature

Use for changes touching storage/persistence, migrations, filesystem writes,
server state, Socket.IO synchronization, player projection, player read-only or
data-exposure boundaries, map/fog rendering semantics, local-network behavior,
security assumptions, dependency changes, setup/validation commands, or any
work where failure could corrupt user data or surprise the GM at the table.

Required workflow:

1. Clarification.
2. Architecture review.
3. Implementation design.
4. Test and validation design.
5. UX and workflow review.
6. Coding with Red/Green TDD where practical.
7. Code review.
8. Docs and tracker review.
9. Final-diff review after implementation and test changes are complete.
10. Main-agent integration and final validation.

The main agent must record clarification answers and stage outputs in the
relevant `docs/features/F-NNN.md` file using Harness Version 1. Required
evidence accumulates by tracker phase; future-stage placeholders are not
required. Required independent reviews for the selected tier must be
independent of the main agent. A human may substitute for a subagent, but the
main agent cannot waive independent review required by the tier.

When classification is ambiguous, choose the higher-risk tier. A Tier 1 or Tier
2 feature must be reclassified if implementation discovers storage,
projection, synchronization, data-integrity, security, or rendering risks.

Critical and high findings block completion until fixed. Medium findings must
be fixed or explicitly accepted/deferred by `human:user` with an existing bug,
engineering item, or decision, a non-expired review date, and residual risk.
Low findings require a disposition. The exact evidence contract and phase rules
are defined in `docs/ai-harness.md` and enforced by `npm run harness:check`.

## Consequences

- Feature work should be more consistent across AI sessions.
- The documentation harness remains current as implementation proceeds.
- Small, low-risk changes can avoid the full high-risk review stack while still
  preserving explicit scope, validation, and accountability.
- Risky changes still receive the full independent review workflow.
- The main agent must not blindly apply subagent output; it must reconcile conflicts with project constraints.
- The harness may initially enforce a stricter common Markdown structure than
  the tier policy requires; until harness automation is updated, feature
  records should include enough evidence to satisfy both the selected tier and
  the active harness checks.

## Mechanical Enforcement

[F-009B](../features/F-009B.md) activates a versioned Markdown contract, a
closed legacy baseline, phase-aware evidence checks, review-scope checks, and
governed findings. `npm run quality` runs the harness check before coverage.
Features F-001 through F-004, F-009, and F-009A are the only grandfathered
records; every other feature must adopt Harness Version 1 before leaving
`Proposed`.

The tier policy is the product/process decision. If the active harness has not
yet been updated to encode tier-specific evidence, agents must either provide
the stricter evidence currently required by the harness or complete a separate
engineering change to update the harness before relying on reduced evidence.

## Alternatives Considered

- Optional subagents: rejected because optional process is easy to skip under short prompts.
- Main-agent-only implementation: rejected because it concentrates architecture, design, coding, review, and documentation checks into one context.
- Full heavyweight project-management workflow: rejected because TabletopFog should stay lightweight; this decision only defines the minimum mandatory AI-assisted stages.
- One mandatory full workflow for every feature: superseded because it caught
  real issues in risky work but burned too much context on low-risk planning and
  narrow changes.
