# Plan: Spec-first split flow: enhance the spec with split reentrancy

Issue: [941-spec-first-split-flow-enhance-the-spec-with-split-reentrancy.md](../../issues/941-spec-first-split-flow-enhance-the-spec-with-split-reentrancy.md)

**Spec hub:** [docs/agents/specs/spec-first-split-flow/specs.md](../../specs/spec-first-split-flow/specs.md)

## Overview

Docs-only spec enhancement. Write a new spec part, `reentrancy.md`, that defines Flow A's second split: the spec-driven split that creates the implementation issues from the finished spec. Then link it from the hub, remove the reentrancy open point, add its fold-map row, and add one-line cross-references in the parts it touches. Nothing is implemented. That is #938's implementation item 10.

## Context

The spec hub `docs/agents/specs/spec-first-split-flow/specs.md` (written by #940) lists nine parts and keeps split reentrancy as an open point for #941. `ordering.md` already has a Flow A edge that defers the reentrancy details to #941. The issue settles every decision: mode trigger, inputs, coverage (unit, rule, gaps, record), recursion guard, dependency links, readiness gate, and the effects on the implementation-split issue. The plan's job is to put those decisions into the spec in its present-tense contract style, without duplicating text that other parts already own.

Every file touched is under `docs/agents/`, which is the architect's own scope. No specialist agent has work, so this is a single, unsplit plan carried out by the architect.

## Steps

- [01 — Write reentrancy.md](plan/01-write-reentrancy-part.md)
- [02 — Update the hub](plan/02-update-hub.md)
- [03 — Add cross-references in the touched parts](plan/03-cross-references.md)
- [04 — Apply the spec-status rule](plan/04-spec-status.md)

## CI Checks

No CI job covers `docs/agents/` markdown. Before committing, check by hand:

- Every relative link in `reentrancy.md` and in each edited part resolves to an existing file under `docs/agents/specs/spec-first-split-flow/`.
- `grep -n "#941" docs/agents/specs/spec-first-split-flow/*.md` returns nothing that still calls reentrancy an open point.

## Notes

- **Scope:** only `reentrancy.md` and edits to existing spec parts and the hub, plus the `docs/agents/specs.md` Status column if Step 04 applies. Do not touch `docs/agents/architecture/spec-pipeline.md`. The fold (#946) fills it, and the fold-map row only names it as the destination.
- **Out of scope, owned by sibling issues:** interaction design for the new prompts (the gate stop, the label-without-pointer choice, and gap waivers) belongs to #942. Edge cases and tests belong to #943, and alternatives to #944. `reentrancy.md` states *what* is asked, not *how*. It may point at those issues as open points.
- **Label name:** the exact name of the implementation-split type label is picked by #938's implementation item 8 and isn't in the spec yet. `reentrancy.md` calls it "the canonical implementation-split type label" (and the same for the implementation and fold type labels) without inventing a name.
- **Guard wording conflict:** `guard.md` currently lists `arcanum-split-issue` as *not covered*, because it only creates bodies. In spec-driven mode the split updates an existing body: the implementation-split issue's `## Coverage` table, the `#NNN` replacement, and the "add the pointer" option. The issue says both updates go through the shared push guard. Step 03 has to fix this, or the spec contradicts itself.
- **Backward compatibility:** a normal split of an issue *without* a pointer is unchanged. The only change to the normal split is that a spec-carrying parent's pointer is copied verbatim into its sub-issues. `reentrancy.md` and `pointer.md` must both say so.
