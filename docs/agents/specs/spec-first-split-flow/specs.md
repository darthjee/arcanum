# Spec: Spec-first split flow

- **Status:** Drafting
- **Origin:** #938
- **Folded by:** #946

## Goal

Specs become transient artifacts of the issue pipeline. A spec is written before implementation begins, governs that implementation, and is folded into `docs/agents` and removed when the originating epic completes.

To make that work, the pipeline gains three things:

- A split flow that emits spec issues (`arcanum-split-issue`).
- A canonical pointer from an issue to its spec hub.
- Spec-aware consumers (`discuss-issue`, `plan-issue` and `auto-plan-issue`) that read the hub when one is declared.

## Scope

**In:**

- A new split topic, three flows, a config key, and the template and migration.
- The canonical pointer line and its validation.
- The shared resolver and the shared dialogue for spec consumption.
- Spec consumption in `discuss-issue`, `plan-issue` and `auto-plan-issue`.
- The pointer-preservation contract in body-rewriting skills, with its tests.
- Canonical issue types and labels, and the ordering dependency.
- Split reentrancy: generating implementation issues from specs.
- The fold procedure and the `docs/agents/specs.md` contract amendment.
- The per-repo migration and the documentation updates.

**Out:**

- Backfilling pointers into existing issues.
- Any spec format beyond the single-file and index-plus-parts layouts.
- Modifying closed issues during the fold.
- Standalone (issue-less) specs such as `shell-engine-removal`. They keep their lifecycle: the resolver acts only on a declared pointer and never scans `docs/agents/specs/`.
- The user-facing `arcanum` CLI (`cli/`).
- Spec consumption in `auto-fix-issue`, which follows the plan and does not call the resolver. This is tracked in #939.

## Key decisions

- Lifecycle and the three flows: [flows.md](flows.md)
- The canonical issue-to-spec pointer: [pointer.md](pointer.md)
- The safety criterion, the resolver contract and git evidence: [resolver.md](resolver.md)
- The shared dialogue, automation behaviour and the precedence rule (the spec governs technical design, the issue keeps scope and intent): [dialogue.md](dialogue.md)
- The shared push guard: [guard.md](guard.md)
- "Blocked by" ordering: [ordering.md](ordering.md)
- Split reentrancy (the spec-driven split, coverage, the recursion guard and the fold links): [reentrancy.md](reentrancy.md)
- The fold and its rules: [fold.md](fold.md)
- The migration plan and release timing: [migration.md](migration.md)
- Epic acceptance criteria and risks: [acceptance.md](acceptance.md)

## Open points

Each enhancement issue creates its own part and adds it to this hub and to the fold map.

- #942, flow choice and interaction (`interaction.md`): where the per-issue flow choice is stored (config key, tiers, default, how downstream skills read it), and whether the split question and the resolver dialogue use a TTY-first script (exit `4` / `FALLBACK=chat`) or chat only.
- #943, edge cases and testing strategy (`testing.md`).
- #944, alternatives considered (`alternatives.md`).
- Canonical issue-type label names, including the implementation-split and fold type labels: no part defines them yet. #938 implementation item 8 names them.

## Parts

- [flows.md](flows.md)
- [pointer.md](pointer.md)
- [resolver.md](resolver.md)
- [dialogue.md](dialogue.md)
- [guard.md](guard.md)
- [ordering.md](ordering.md)
- [reentrancy.md](reentrancy.md)
- [fold.md](fold.md)
- [migration.md](migration.md)
- [acceptance.md](acceptance.md)

## Fold map

| Part / section | Destination |
| --- | --- |
| hub: Goal, Scope, Open points | `drop` |
| `flows.md` | `docs/agents/flow.md` (spec lifecycle and the three flows) |
| `pointer.md` | `docs/agents/architecture/spec-pipeline.md` |
| `resolver.md` | `docs/agents/architecture/spec-pipeline.md` |
| `dialogue.md` | `docs/agents/architecture/spec-pipeline.md` |
| `guard.md` | `docs/agents/architecture/spec-pipeline.md` |
| `ordering.md` | `docs/agents/architecture/spec-pipeline.md` |
| `reentrancy.md` | `docs/agents/architecture/spec-pipeline.md` |
| `fold.md` | `docs/agents/specs.md` (end of the pipeline-spec lifecycle) and `docs/agents/architecture/spec-pipeline.md` (the fold procedure) |
| `migration.md` | `drop` (migrations document themselves in their `NNN.md` files) |
| `acceptance.md` | `drop` (build history) |
