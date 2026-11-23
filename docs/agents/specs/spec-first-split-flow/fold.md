# Fold

Hub: [specs.md](specs.md)

## The fold issue

The fold issue runs before any pointer can become orphaned. Its blocking edges are defined in [ordering.md](ordering.md).

It:

- Writes provenance into the destination docs in `docs/agents`.
- Removes the spec files or the topic directory.
- Removes the row from the `specs.md` index.
- Never rewrites historical issues.

**Rationale:** provenance at the destination, rather than a mutation of closed issues, keeps the pointer immutable. It also lets the resolver turn a bare not-found into an actionable message (see [resolver.md](resolver.md)).

## The hub declares the map

- Every pipeline hub carries a `## Fold map`. Each section or part maps to a destination under `docs/agents` (an existing document, or a new one named in the map), or to `drop`.
- The generation issue starts the map, the enhancement issues refine it, and the fold only carries it out.
- The map can be reviewed before the fold runs, so the fold is idempotent and re-runnable. A re-run with the same map changes nothing and never duplicates a footer.

## Fold the final state

Durable content describes how the system *is* once implemented.

Keep:

- API definitions.
- Command and config contracts.
- Usage definitions.
- Behaviour that other agents rely on.

Drop:

- Status lines.
- Open points and TODOs.
- Implementation order and sub-issue lists.
- Rollout steps.
- Rejected alternatives.
- The `## Fold map` itself.

Folded content is rewritten into the destination's present-tense voice. It is never pasted verbatim.

## Provenance footer

- A visible line at the end of each destination section that received content: ``> Folded from spec `<hub path>` by #<fold issue>.``
- `<hub path>` is the path the pointer carries: `docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md` (see [pointer.md](pointer.md)).
- The resolver greps `docs/agents` for that exact path.
