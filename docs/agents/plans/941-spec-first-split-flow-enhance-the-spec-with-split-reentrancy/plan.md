# Plan: Spec-first split flow: enhance the spec with split reentrancy

Issue: [941-spec-first-split-flow-enhance-the-spec-with-split-reentrancy.md](../../issues/941-spec-first-split-flow-enhance-the-spec-with-split-reentrancy.md)

## Overview

Docs-only spec enhancement. Write a new part, `reentrancy.md`, in `docs/agents/specs/spec-first-split-flow/` that defines Flow A's second, spec-driven split (mode trigger, inputs, coverage, recursion guard, dependency links, readiness gate, effects on the implementation-split issue, trust boundaries, label references). Add the part-path confinement rule to `resolver.md`, one-line cross-references from `pointer.md`, `ordering.md`, `resolver.md` and `dialogue.md`, and update the hub (Parts, Key decisions, Open points, Fold map, Status). Nothing is implemented; that is #938's implementation item 10.

## Context

- Parent epic #938; the spec hub was created by #940 at `docs/agents/specs/spec-first-split-flow/specs.md`.
- Every decision is already settled in the issue body, section by section ("Settled: ..."). The work is to transcribe them into the spec's present-tense contract style (short declarative bullets, `Hub: [specs.md](specs.md)` back-link under the H1, `**Rationale:**` lines where a why is needed), not to redesign anything.
- The hub currently lists #941 under Open points and `ordering.md` says "The reentrancy details are an open point (#941)".
- Owned by the architect: everything touched lives under `docs/agents/`. No specialist agent has work.

## Steps

- [01 — Write reentrancy.md](plan/01-write-reentrancy-part.md)
- [02 — Resolver confinement rule and cross-references](plan/02-resolver-rule-and-cross-references.md)
- [03 — Update the hub and the specs index](plan/03-update-hub-and-index.md)

## Notes

- **Spec status rule.** At planning time #942, #943 and #944 are all OPEN, so the hub `Status` (and the `docs/agents/specs.md` row) stays `Drafting`. Re-check with `gh issue view <n> --json state` for 942–944 right before opening the PR; switch both to `Ready` only if all three are closed.
- **No literal label names.** `reentrancy.md` must say "the implementation-split type label" and "the fold type label" only, defining both terms once as the canonical labels named by #938 implementation item 8.
- **Do not duplicate.** Cross-references in other parts are one line each pointing at `reentrancy.md`; the confinement rule lives in `resolver.md` and `reentrancy.md` only references it.
- **Out of scope:** interaction design of the new prompts (#942), edge cases and tests (#943), alternatives (#944). `reentrancy.md` defines what is asked, not how.
- No CI job covers `docs/agents/`; verify links by hand (every relative link in the touched files resolves).
