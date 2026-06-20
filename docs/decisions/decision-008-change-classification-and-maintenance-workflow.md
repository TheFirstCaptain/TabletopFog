# Decision 008: Change Classification and Maintenance Workflow

## Context

TabletopFog tracks product capabilities in `docs/features/` and defects in
`docs/bugs/`. A repository audit identified behavior-preserving refactors and
maintenance tasks that do not fit either category cleanly. Treating those tasks
as product features would distort the roadmap, while leaving them untracked
would make them easy to lose between AI-assisted sessions.

## Decision

Repository changes use three classifications:

- Features add a new product, developer, tooling, or workflow capability and
  are tracked in `docs/features/`.
- Bugs describe implemented or promised behavior that is broken, unsafe, or
  materially misleading and are tracked in `docs/bugs/`.
- Engineering maintenance preserves intended behavior while improving internal
  structure, tests, diagnostics, or maintainability and is tracked in
  `docs/engineering/`.

Feature work continues to use the mandatory feature SDLC. Bug fixes use a
smaller reproduce, test, fix, review, and validate loop. Engineering maintenance
must state the behavior being preserved, define its boundaries, and validate
that behavior before completion.

If work changes classification while being investigated, move or cross-link the
record rather than duplicating ownership. A maintenance task that exposes broken
promised behavior becomes a bug. A bug fix that adds a materially new capability
requires a feature.

## Consequences

- Product roadmap entries remain outcome-oriented.
- Confirmed defects retain explicit reproduction and validation evidence.
- Internal quality work has durable ownership without being presented as user
  functionality.
- Contributors and agents must classify work before implementation and keep the
  appropriate tracker current.
- The repository gains a small amount of documentation overhead.

## Alternatives Considered

- Track everything as a feature: rejected because refactors and cleanup would
  obscure the product roadmap.
- Track all technical work as bugs: rejected because maintainability work is not
  necessarily broken behavior.
- Leave maintenance in handoff notes: rejected because handoff notes do not
  provide durable status or ownership.
