# Plan: Spec-first split flow: write the spec (generation)

Issue: [940-spec-first-split-flow-write-the-spec-generation.md](../../issues/940-spec-first-split-flow-write-the-spec-generation.md)

## Overview

Create the spec hub `docs/agents/specs/spec-first-split-flow/specs.md` and its nine parts. They turn the design decisions of epic #938 (D1–D12, its scope, acceptance criteria, risks and confirmed assumptions), plus the refinements settled on #940, into normative contract prose. Also start the hub's `## Fold map`, register the spec in `docs/agents/specs.md`, document the `<topic>/specs.md` hub form there, and add a stub `docs/agents/architecture/spec-pipeline.md` with its row in `docs/agents/architecture.md`.

This is documentation only, and all of it is architect-owned (`docs/agents/`). No specialist agent has work, so the plan is not split by agent.

## Context

- Every other sub-issue of #938 (#941–#946) carries `**Spec hub:** [docs/agents/specs/spec-first-split-flow/specs.md](...)` and treats that hub as its technical contract. The hub does not exist yet, and this issue creates it (Flow A, generation phase).
- `docs/agents/specs.md` currently documents only the `<topic>.md` hub form, with parts under `<topic>/<part>.md`. This spec uses the directory form `<topic>/specs.md`, so the contract needs a small additive amendment.
- Source of truth: once the spec exists, the spec governs the technical design. #938 keeps authority over scope and intent, and its D1–D12 stay as a historical record. The spec records every refinement as settled content, not as a diff against #938.
- Settled refinement to carry in (it overrides #938 D3/D9): the pointer goes on **the first non-blank line of the body, or, when the body opens with an H1, the first non-blank line after that H1**. Emitters write it there, and the push guard re-inserts a dropped pointer at the same spot. The resolver scans the whole body, the first match wins, and a pointer found anywhere else adds a `warnings[]` entry.
- Writing style:
  - Rewrite, don't copy: present-tense normative prose, hard rules as bullets, and a short **Rationale** paragraph wherever #938 gave a reason.
  - Add no new decisions. Anything undecided goes under the hub's Open points.
  - Use no origin tags like `(#938 D5)`.
  - Match the `docs/agents` voice.
- Out of scope:
  - Any implementation, and `init-claude/templates/specs.md`.
  - Mentioning the spec in `docs/agents/flow.md` or `AGENTS.md`.
  - Editing #938.
  - Copying #938's 13-item implementation breakdown.
  - Placeholder files for the enhancement topics (#941–#944).

## Steps

- [01 — Amend the specs contract and index](plan/01-amend-specs-contract-and-index.md)
- [02 — Write the hub](plan/02-write-the-hub.md)
- [03 — Write flows.md and pointer.md](plan/03-write-flows-and-pointer.md)
- [04 — Write resolver.md and dialogue.md](plan/04-write-resolver-and-dialogue.md)
- [05 — Write guard.md, ordering.md and fold.md](plan/05-write-guard-ordering-and-fold.md)
- [06 — Write migration.md and acceptance.md](plan/06-write-migration-and-acceptance.md)
- [07 — Add the spec-pipeline architecture stub](plan/07-add-spec-pipeline-stub.md)
- [08 — Verify links and coverage](plan/08-verify-links-and-coverage.md)

## Notes

- **Coverage check against #938.** Every decision lands in exactly one part:
  - D1, D2 → `flows.md`
  - D3 → `pointer.md`
  - D4, D5, D6 → `resolver.md`
  - D7, D8 → `dialogue.md`
  - D9 → `guard.md`
  - D10 → `fold.md`
  - D11 → `ordering.md`
  - D12 → `migration.md`

  The "Confirmed assumptions" and the scope belong somewhere too:
  - Restore semantics → `resolver.md`/`dialogue.md`
  - `plan-issue` as a consumer → `dialogue.md`
  - The 2.5.0 minor bump → `migration.md`
  - Scope in/out, including `auto-fix-issue` → #939 and standalone specs → hub
- **Provenance footer path.** #938 D10 writes the footer as ``> Folded from spec `docs/agents/specs/<topic>.md` by #<n>.``, but D3 allows both hub forms. `fold.md` should write it as the spec's **hub path** (for this spec, `docs/agents/specs/spec-first-split-flow/specs.md`). This is the path the resolver greps for, since it is the path the pointer carries. It reads D10 consistently with D3 and adds no new decision. If a reviewer sees it as a decision, move it to the hub's Open points.
- **Hub status vocabulary** (`Drafting` / `Ready` / `Implementing`, no final status) is recorded in the spec itself. `flows.md` holds it, next to the lifecycle. It is not added to `docs/agents/specs.md`: that file gets only the hub-form amendment in this issue, and the rest of the contract change is #938's implementation item 1.
- The issue file `docs/agents/issues/940-spec-first-split-flow-write-the-spec-generation.md` is currently untracked. The plan commit stages only `PLAN_DIR`.
- No CI job checks `docs/agents/specs/`, so there is no `## CI Checks` section. Step 08's manual link and coverage check is the verification.
