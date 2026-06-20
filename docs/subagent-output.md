# Subagent Output Format

Use this compact format for mandatory SDLC subagent outputs. The main agent
records stage results and every material finding, including rejected
recommendations, in the relevant `docs/features/F-NNN.md` file.

## Required Output

Each subagent should provide:

- Summary: one or two sentences describing the result.
- Findings: concrete issues, decisions, or confirmations.
- Recommendations: specific next actions.
- Files likely affected: paths or areas, if known.
- Validation required: automated and manual checks.
- Blockers: missing information or external constraints.

The main agent converts completed governed stages into this exact feature-record
shape:

```md
### Code Review

- Reviewer: /root/code_review
- Completed: 2026-06-20
- Result: Pass
- Evidence: Reviewed the completed diff and recorded concrete findings.
```

Reviewer identities must be `/root/<task>`, `/root` for main-agent stages, or
`human:<identifier>`. Do not use placeholder evidence. Preserve every material
finding in the governed table even when its recommendation is rejected.

## Stage-Specific Notes

Architecture review should focus on fit with `docs/architecture.md`, decisions, roadmap, and MVP boundaries.

Implementation design should define data flow, files touched, state shape, sequencing, and rollback concerns.

Test and validation design should define automated tests, manual tests, device checks, and network checks.

UX and workflow review should focus on GM/player ergonomics, read-only player behavior, iPad display, and avoiding VTT scope creep.

Coding notes should record Red/Green TDD evidence where practical.

Code review should lead with bugs, regressions, missing tests, and maintainability risks.

Docs and tracker review should verify updates to feature docs, bug docs, acceptance tests, ADRs, and command documentation.

Final-diff review should inspect the complete implementation and test diff after
all intended edits. Final validation should cite the commands and manual checks
actually completed.
