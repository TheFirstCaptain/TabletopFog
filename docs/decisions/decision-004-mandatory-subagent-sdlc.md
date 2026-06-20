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
9. Main-agent integration and final validation.

The main agent must record clarification answers and stage outputs in the relevant `docs/features/F-NNN.md` file.

## Consequences

- Feature work should be more consistent across AI sessions.
- The documentation harness remains current as implementation proceeds.
- Small features may take more process than a direct edit, but this is intentional for preserving scope and quality.
- The main agent must not blindly apply subagent output; it must reconcile conflicts with project constraints.

## Planned Enforcement Hardening

[F-009B](../features/F-009B.md) is planned to make this decision mechanically
verifiable. It will define structured evidence for each stage, require material
findings and their dispositions to remain visible, add stage-specific review
checklists, and require final-diff review. Until F-009B is implemented, the
current prose workflow remains authoritative and no new automated enforcement is
implied.

## Alternatives Considered

- Optional subagents: rejected because optional process is easy to skip under short prompts.
- Main-agent-only implementation: rejected because it concentrates architecture, design, coding, review, and documentation checks into one context.
- Full heavyweight project-management workflow: rejected because TabletopFog should stay lightweight; this decision only defines the minimum mandatory AI-assisted stages.
