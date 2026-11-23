# Spec Lifecycle and Flows

Hub: [specs.md](specs.md)

## Spec lifecycle

A pipeline spec follows the lifecycle of its originating issue. It is a pipeline artifact, not a permanent document.

| Phase | Actor | Effect on `docs/agents/specs/` |
| --- | --- | --- |
| Split | `arcanum-split-issue` | Emits the pointer; the hub does not exist yet |
| Generation issue | implementation agent | Creates the hub and parts |
| Enhancement issues | implementation agent | Refine the spec |
| Implementation issues | planning and fix agents | Read the hub as the technical source of truth |
| Fold issue | implementation agent | Folds the durable content into `docs/agents`, removes the spec, updates the index |

## Pipeline-spec status

A pipeline spec's hub `Status` uses a fixed vocabulary:

- `Drafting`: at least one enhancement issue is open. The generation issue sets it.
- `Ready`: every enhancement issue is closed, so the implementation split can run. The enhancement issue that closes last sets it.
- `Implementing`: the implementation issues exist. The implementation-split issue sets it.

Rules:

- There is no final status, because the fold removes the spec.
- The issue that moves the phase updates the hub's `Status` and the Status column of the spec's row in `docs/agents/specs.md`, in the same PR.
- Standalone specs (such as `shell-engine-removal`) keep their free-text status. This vocabulary applies only to pipeline specs.

## The three flows

The split interview gains one topic: whether to write specs in `docs/agents/specs/`. It has three outcomes.

**Flow A: specs first, implementation in a later split.**

1. Generation issue: writes the initial spec.
2. N enhancement issues: detail the spec (only if needed).
3. Implementation-split issue: a new split that creates the implementation issues *from the spec*.
4. Fold issue: folds the spec into `docs/agents` and removes it.

**Flow B: specs and implementation in the same split.**

1. Generation issue: writes the initial spec.
2. N enhancement issues: detail the spec (only if needed).
3. N implementation issues.
4. Fold issue: folds the spec into `docs/agents` and removes it.

**Flow C: no specs.** Implementation issues only. This is today's behaviour and stays the default.

## Where the question lives

- The split question and its branching live in the skill, which is versioned.
- The repository split-checklist template only overrides the question or opts out of it. See [migration.md](migration.md).
- Where the per-issue flow choice is persisted, and the config key that carries it, are open points (#942), not decided here.
