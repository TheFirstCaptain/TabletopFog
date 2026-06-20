# Decision 004: Mandatory Subagent SDLC for Feature Work

## Context

TabletopFog is intended to be developed through AI-assisted feature work. A common user prompt may be as short as "let's do the next feature." Without a structured workflow, an agent could skip clarification, overbuild, miss project boundaries, or fail to update the documentation harness.

## Decision

Every new feature must use a mandatory SDLC-style subagent workflow.

The main agent remains accountable for coordination, scope control, integration, validation, and the final handoff. Subagents provide focused review or execution for required stages.

Required stages:

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
required. Architecture, test, UX, code, docs, and final-diff review must be
independent of the main agent. A human may substitute for a subagent, but the
main agent cannot waive independent review.

Critical and high findings block completion until fixed. Medium findings must
be fixed or explicitly accepted/deferred by `human:user` with an existing bug,
engineering item, or decision, a non-expired review date, and residual risk.
Low findings require a disposition. The exact evidence contract and phase rules
are defined in `docs/ai-harness.md` and enforced by `npm run harness:check`.

## Consequences

- Feature work should be more consistent across AI sessions.
- The documentation harness remains current as implementation proceeds.
- Small features may take more process than a direct edit, but this is intentional for preserving scope and quality.
- The main agent must not blindly apply subagent output; it must reconcile conflicts with project constraints.

## Mechanical Enforcement

[F-009B](../features/F-009B.md) activates a versioned Markdown contract, a
closed legacy baseline, phase-aware evidence checks, review-scope checks, and
governed findings. `npm run quality` runs the harness check before coverage.
Features F-001 through F-004, F-009, and F-009A are the only grandfathered
records; every other feature must adopt Harness Version 1 before leaving
`Proposed`.

## Alternatives Considered

- Optional subagents: rejected because optional process is easy to skip under short prompts.
- Main-agent-only implementation: rejected because it concentrates architecture, design, coding, review, and documentation checks into one context.
- Full heavyweight project-management workflow: rejected because TabletopFog should stay lightweight; this decision only defines the minimum mandatory AI-assisted stages.
