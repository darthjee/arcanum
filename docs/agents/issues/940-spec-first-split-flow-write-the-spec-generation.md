# Issue: Spec-first split flow: write the spec (generation)

**Spec hub:** [docs/agents/specs/spec-first-split-flow/specs.md](docs/agents/specs/spec-first-split-flow/specs.md)

## Description
Parent epic: #938 (Spec-first split flow for `arcanum-split-issue`). This epic runs through the flow it introduces (Flow A). The full design decisions live in #938. This is the **spec generation** issue: it creates the spec hub that every other sub-issue reads.

The spec hub is `docs/agents/specs/spec-first-split-flow/specs.md`. It is architect-owned documentation under `docs/agents/`; no code changes.

## Problem
Every other sub-issue of #938 (#941–#946) declares this spec hub as its technical contract, but the hub does not exist yet. Until it does, the enhancement issues have nothing to refine and the implementation split has no source of truth. The current `docs/agents/specs.md` contract also only documents the `<topic>.md` hub form, not the `<topic>/specs.md` form this spec uses.

## Expected Behavior
### Acceptance criteria
- The hub and parts exist, link to each other, and cover every settled decision in #938.
- The `## Fold map` covers every part.
- `docs/agents/specs.md` lists the spec.
- `docs/agents/specs.md` documents the `<topic>/specs.md` hub form, so the spec's own path matches the contract.
- `docs/agents/architecture/spec-pipeline.md` exists as a stub pointing at the spec hub, and `docs/agents/architecture.md` lists it.

### Out of scope
- Any implementation: this issue only writes docs under `docs/agents/specs/`, the index row, the minimal hub-form amendment to `docs/agents/specs.md`, and the `spec-pipeline.md` stub with its `architecture.md` row.
- Mentioning the in-progress spec in `docs/agents/flow.md` or `AGENTS.md`: until the fold, the `specs.md` index row is the only entry point.
- `init-claude/templates/specs.md` (implementation item 1) and any further edit to #938's body.
- Copying #938's implementation breakdown into the spec.
- Topics owned by the enhancement issues (split reentrancy, flow choice and interaction, edge cases and testing, alternatives). Leave them as open points in the hub.

## Solution
### Task
- Create the hub `docs/agents/specs/spec-first-split-flow/specs.md` and the parts beside it, following the [part layout](#part-layout) below.
- Take the content from #938: design decisions 1–12 (spec lifecycle, the three flows, the pointer format, the safety criterion, the resolver contract, evidence via git, the shared dialogue, automation behaviour, the shared push guard, the fold rules, GitHub "blocked by" ordering, and the migration plan), plus its scope, acceptance criteria and risks.
- Keep the hub small: status, goal, scope, key decisions, open points, and links to the parts.
- Start the hub's `## Fold map` (section/part → `docs/agents` destination, or `drop`).
- Add the row for this spec to `docs/agents/specs.md`'s Active specs table.
- Create `docs/agents/architecture/spec-pipeline.md` as a **stub** and add its row to the `docs/agents/architecture.md` hub table. The stub has a title, a one-paragraph purpose (the runtime contract of the spec pipeline: pointer, resolver, dialogue, push guard, ordering, fold), and a note that the contract currently lives in the spec hub and is folded in by #946. It holds no contract text of its own, so there is a single copy of the truth until the fold.
- Amend `docs/agents/specs.md` minimally so the hub path this spec uses is documented. In **File layout** (and the matching bullet in **Writing specs**), add the `<topic>/specs.md` hub form next to the existing `<topic>.md` form: a topic directory whose entry point is `docs/agents/specs/<topic>/specs.md`, with its parts beside it in the same directory. Only the hub is listed in the index.
  - This pulls a small slice of #938's implementation item 1 forward. The rest of item 1 (issue-originated specs, the `## Fold map`, removal at completion) stays there.
  - Only the repository's own `docs/agents/specs.md` changes. `init-claude/templates/specs.md`, which `arcanum/migrations/repos/next/001.sh` copies into consumer repos, is still updated by implementation item 1.

### Refinements to carry into the spec
Decisions settled while enhancing this issue that refine #938's text. The spec records them as settled, not as open points.
- **Pointer placement (refines #938 decision 3).** Issue bodies on GitHub come in two shapes: the split's sub-issues have no H1 in the body (the title lives only in the GitHub title), while issues like #938 open with `# <title>`. The canonical spot for the pointer is therefore **the first non-blank line of the body, or, when the body opens with an H1, the first non-blank line after that H1**. Emitters (the split and the body templates) write it there, and the push guard re-inserts a dropped pointer at the same spot. The resolver still scans the whole body, the first match wins, and a pointer found anywhere else adds a `warnings[]` entry.

### Part layout
All files live in `docs/agents/specs/spec-first-split-flow/`. Each design decision (D1–D12) of #938 lands in exactly one part.

| File | Content |
| --- | --- |
| `specs.md` (hub) | Status, goal, scope (in/out), origin, a one-line summary of each key decision linking to its part, open points, links to every part, `## Fold map` |
| `flows.md` | D1 spec lifecycle; D2 the three flows (A, B, C) |
| `pointer.md` | D3 the canonical pointer: format, validation/allowlist, and placement (see [Refinements to carry into the spec](#refinements-to-carry-into-the-spec)) |
| `resolver.md` | D4 the safety criterion; D5 the resolver contract (`none` / `ready` / `not_ready{reason}`, output shape, properties); D6 git evidence for `missing` |
| `dialogue.md` | D7 the shared dialogue; D8 automation behaviour; the precedence rule (the spec wins on technical detail, the issue keeps authority over scope and intent) |
| `guard.md` | D9 the shared push guard (covered skills, re-insert on drop, refuse on change, `--allow-pointer-change`) |
| `ordering.md` | D11 GitHub "blocked by" edges per flow; queue-entry and pop-time rules |
| `fold.md` | D10 the fold, plus the fold rules (hub-owned map, final state only, provenance footer) |
| `migration.md` | D12 the migration plan (amend `next/003`, ship the template through `next/001`, one instructions migration) and the 2.5.0 timing constraint |
| `acceptance.md` | #938's epic-level acceptance criteria and risks |

- No placeholder files for the enhancement topics. The hub lists them under **Open points**, each linked to its issue; each enhancement issue creates its own part and adds it to the hub and the fold map:
  - `reentrancy.md`: #941 (split reentrancy)
  - `interaction.md`: #942 (flow choice persistence, config key, interaction design)
  - `testing.md`: #943 (edge cases and testing strategy)
  - `alternatives.md`: #944 (alternatives considered; `drop` in the fold map)

### Hub header
The hub opens with a short metadata list, before `## Goal`:

```markdown
# Spec: Spec-first split flow

- **Status:** Drafting
- **Origin:** #938
- **Folded by:** #946
```

- **Fields:** `Status`, `Origin` (the epic the spec belongs to) and `Folded by` (the issue that will remove it). There is no "generated by" field: the generation issue is the one that adds the hub, which git history already records.
- **Status vocabulary for a pipeline spec:**
  - `Drafting`: at least one spec enhancement issue is still open. #940 sets this.
  - `Ready`: every enhancement issue is closed, so the implementation split can run. The enhancement issue that closes while no other enhancement issue is open sets it.
  - `Implementing`: the implementation issues exist. #945 sets it.
  - The fold (#946) removes the spec, so there is no final status.
- **Who updates it:** whichever issue moves the phase updates both the hub and the Status column of the spec's row in `docs/agents/specs.md`, in the same PR.
- Standalone specs (like `shell-engine-removal`) keep their current free-text status. This vocabulary applies only to pipeline specs.

### Initial fold map
The hub's `## Fold map` starts as below. `docs/agents/architecture/spec-pipeline.md` is a **new** architecture doc carrying the runtime contract of the spec pipeline. This issue creates it as a stub (see [Task](#task)), and the fold issue (#946) fills it. Every other destination already exists.

| Part / section | Destination |
| --- | --- |
| hub: Goal, Scope, Open points | `drop` |
| `flows.md` | `docs/agents/flow.md` (spec lifecycle and the three flows) |
| `pointer.md` | `docs/agents/architecture/spec-pipeline.md` (new) |
| `resolver.md` | `docs/agents/architecture/spec-pipeline.md` |
| `dialogue.md` | `docs/agents/architecture/spec-pipeline.md` |
| `guard.md` | `docs/agents/architecture/spec-pipeline.md` |
| `ordering.md` | `docs/agents/architecture/spec-pipeline.md` |
| `fold.md` | `docs/agents/specs.md` (the end of the pipeline-spec lifecycle) and `docs/agents/architecture/spec-pipeline.md` (the fold procedure) |
| `migration.md` | `drop` (the migrations document themselves in their own `NNN.md` files) |
| `acceptance.md` | `drop` (build history) |

Suggested destinations for the parts the enhancement issues add. Each issue adds its own row when it creates the part:
- `reentrancy.md` (#941) → `docs/agents/architecture/spec-pipeline.md`
- `interaction.md` (#942) → `docs/agents/architecture/config-keys.md` (the config key) and `docs/agents/architecture/spec-pipeline.md` (the interaction design)
- `testing.md` (#943) → `drop`
- `alternatives.md` (#944) → `drop`

### Source of truth
- Once this issue's spec exists, **the spec governs the technical design**. #938 keeps authority over scope and intent, and its design decisions 1–12 stay as a historical record. Where the two differ (for example, the pointer placement refinement above), the spec wins. This is the same precedence rule the spec defines for implementation issues.
- #938's body already says this: its pointer line and a governance note were added right after its H1 while this issue was being enhanced. #938 is not trimmed or rewritten further.
- The spec therefore records every refinement made after #938 as settled content, not as a diff against #938.
- **The implementation breakdown stays in #938.** The 13-item "Implementation breakdown (draft)" is about scope, so it stays in #938, the input #945 starts from. The spec does **not** copy it: the spec is a design contract with no issue lists or sequencing. #945 checks the breakdown against the finished spec's coverage.

### Writing style
- **Rewrite, don't copy.** Each part turns #938's decisions into present-tense, normative contract prose ("The resolver returns…", "The guard refuses…"). Hard rules are bullets, and a short **Rationale** paragraph keeps the *why* wherever #938 gave one.
- **Same meaning, no new decisions.** The spec says what #938 decided plus the refinements recorded in this issue. Anything still undecided goes under the hub's Open points (or the matching enhancement issue), never as an invented answer.
- No origin tags such as `(#938 D5)`: they are build history and the fold would have to strip them. The hub's `Origin: #938` is the only cross-reference.
- The voice matches `docs/agents`, so the fold needs little rewording.

### Project concerns
- **Backward compatibility:** docs only. The `docs/agents/specs.md` amendment is additive (a second hub form); existing specs and their links are unchanged.
- **Testing:** no code. The PR is checked by verifying that every relative link in the hub and parts, and the new index row, resolves to an existing file, and that every part appears in the hub and in the `## Fold map`.
- **Migration:** none for this issue. The consumer-facing template change stays with #938's implementation item 1.
- **Script-driven interaction / new root-level folder:** not applicable. Everything lives under the existing `docs/agents/specs/`, owned by the architect.

### Sibling issues
When this issue was enhanced, each sibling's body got one status line (in GitHub only, not part of this issue's PR): #941–#944 set the hub Status to `Ready` when they close while no other enhancement issue is open, and #945 sets it to `Implementing`. #946 fills the `spec-pipeline.md` stub.

### Dependencies
Blocked by: nothing. Blocks: the four enhancement issues and the implementation-split issue.

## Benefits
- The enhancement issues (#941–#944) and the implementation split (#945) get a single, reviewable technical contract to work from.
- The epic exercises its own Flow A end to end before the feature is automated.
- The fold (#946) can run mechanically from the hub-owned fold map.
