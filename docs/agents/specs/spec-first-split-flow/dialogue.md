# Shared Dialogue, Automation and Precedence

Hub: [specs.md](specs.md)

## One dialogue definition

`discuss-issue`, `plan-issue` and `auto-plan-issue` share **one** dialogue definition through cross-skill reference, so the options cannot drift. `plan-issue` consumes the spec through the same resolver and dialogue as the other two, so manual planning sees the spec too.

## Options

For `missing` and `partial`:

- Write (or complete) the spec now.
- Restore from `{commit}`. This is offered only when git shows a deletion of that path (see [resolver.md](resolver.md)).
- Proceed without the spec, for this session only.
- Abort.

For `invalid`:

- Fix the field to a valid path. This is the only option that passes `--allow-pointer-change` to the push guard (see [guard.md](guard.md)).
- Proceed without the spec, for this session only.
- Abort.

## Rules

- **Writing the spec.** When the user chooses to write it, the skill reports the exact path it will use. In `missing` the path comes from the issue. In `invalid` the path has to be defined.
- **Non-persistence.** "Proceed without the spec" never mutates the issue, the pointer or any state file.
- **Consumption.** On `ready`, the consumer reads the hub and then its parts before it discusses or plans.
- **Spec-driven split.** It reuses this dialogue on `not_ready`, where "proceed without the spec" drops it to a normal split (see [reentrancy.md](reentrancy.md)).

## Precedence rule

- The spec wins on technical detail.
- The issue keeps authority over scope and intent.
- On a scope divergence, the consumer asks the user instead of choosing.

## Automation behaviour

- **Covered skills.** `auto-plan-issue` is the only automated skill that calls the resolver. `auto-resolve-issue` and `auto-fix-all` drive it and pass its failure on.
- **On `not_ready`** they fail explicitly. They record the reason and the path, the item leaves the queue, and the loop continues with the next id.
- There is no retry counter, no requeue and no silent continuation.
- **Rationale:** this needs no new bookkeeping and keeps the platform invariant that automation does not decide under ambiguity.
- **Not covered.** `monitor-issues` and `auto-rewrite-issue` never plan, so they never call the resolver. Only the push guard binds them (see [guard.md](guard.md)).

## Interaction mechanics

Whether the dialogue runs through a TTY script or through chat only is an open point (#942) and is not specified here.
