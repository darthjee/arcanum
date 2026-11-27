# Issue: Spec-first split flow: enhance the spec with split reentrancy

**Spec hub:** [docs/agents/specs/spec-first-split-flow/specs.md](docs/agents/specs/spec-first-split-flow/specs.md)

## Description
Parent epic: #938 (Spec-first split flow for `arcanum-split-issue`). This epic runs through the flow it introduces (Flow A). The full design decisions live in #938. This is a **spec enhancement** issue. It refines the spec hub created by the generation issue.

## Problem
Flow A needs a second split that creates the implementation issues from the finished spec rather than from the parent issue's prose. #938 names this mode (implementation item 10) but doesn't define how it starts, what it reads, how it proves the spec is fully covered, or what stops a spec-driven split from emitting yet another split.

## Expected Behavior
### Acceptance criteria
- `reentrancy.md` exists in the spec's directory, in the same present-tense contract style as the other parts, and defines, unambiguously: the mode trigger, the inputs, the coverage unit/rule/record, the recursion guard, the dependency links, the readiness gate, the effects on the implementation-split issue, and the trust boundaries.
- `resolver.md` states that the hub's part paths are confined under the spec's root, and that an escaping part link makes the pointer `not_ready` with `reason: invalid`.
- `pointer.md`, `ordering.md`, `resolver.md` and `dialogue.md` each carry a one-line cross-reference to `reentrancy.md` for the decision they touch, without duplicating it.
- The hub lists `reentrancy.md` under Parts, its Open points no longer list reentrancy but do list the undefined label names, and its `## Fold map` has the row `reentrancy.md` → `docs/agents/architecture/spec-pipeline.md`.
- The hub's `Status` (and its row in `docs/agents/specs.md`) follows the "Spec status" rule: `Ready` if no other enhancement issue (#941–#944) is open when this one closes, otherwise `Drafting`.

## Solution
### Task
Design Flow A's second split, where the specs are the source of truth instead of the parent issue's description, and write it into the spec (a new part such as `reentrancy.md`, linked from the hub):
- how the split is started against a spec hub, and what it reads (hub, parts, fold map);
- how it checks coverage: every spec part maps to at least one implementation issue, or is explicitly marked as not needing one;
- the recursion guard: a split started from specs must never emit another implementation-split issue (bounded depth);
- adding each generated implementation issue as a GitHub "blocked by" dependency of the fold issue.

### Settled: how the spec-driven mode starts
- **Auto-detect.** `/arcanum-split-issue <id>` enters spec-driven mode when the issue carries the canonical **implementation-split type label** (defined by #938's implementation item 8, which also picks its exact name) **and** it has a spec pointer. There is no flag. The split prints one line naming the mode and its source of truth, e.g. `spec-driven mode: source of truth is docs/agents/specs/<topic>/specs.md`, so the decision is visible.
- **Pointer but no implementation-split label** (e.g. splitting an ordinary implementation issue further): run the **normal** split. Its flow question defaults to Flow C, and every new sub-issue **copies the parent's pointer line verbatim** into the canonical spot, so the spec keeps governing the sub-issues.
- **Label but no pointer:** the label claims a spec-driven split with no spec to drive it, so that's an anomaly. How the split reacts (and the related resolver states) is settled under the spec readiness gate topic.

### Settled: what the spec-driven split reads
- **Source of truth:** the hub, every part it lists, and the hub's `## Fold map`. They're read only after the resolver returns `ready` for the issue's pointer, so the resolver's no-read rule still holds.
- **Hint, not truth:** if the implementation-split issue's GitHub parent (via the native sub-issue relationship) has a section whose heading starts with `Implementation breakdown`, the split reads it as a **starting suggestion** for grouping. Where it disagrees with the spec, the spec wins (the precedence rule), and the split says which suggested items it changed or dropped and why.
- **`drop` rows are excluded from coverage.** Parts or sections the fold map marks `drop` (e.g. `alternatives.md`, `testing.md`, `acceptance.md`) are read as context, so testing notes and acceptance criteria still shape the issues, but they don't need an implementation issue of their own.

### Settled: coverage check
- **Unit:** each **non-`drop` row of the hub's `## Fold map`** (a part, or a hub section). The fold map already lists every piece of the spec, so coverage needs no second inventory.
- **Rule:** every unit is covered by at least one proposed implementation issue, or **waived** with a reason the user gives in the dialogue. One issue may cover several units.
- **Gaps block.** The split doesn't reach its confirm step while any unit is neither covered nor waived. It lists the gaps and keeps the dialogue going until each one is mapped or waived.
- **Record:** the split adds a `## Coverage` table to the implementation-split issue's body (e.g. #945) as part of the parent draft it publishes before creating sub-issues:

  ```markdown
  ## Coverage
  | Fold-map row | Covered by |
  | --- | --- |
  | `resolver.md` | Shared resolver |
  | `guard.md` | Pointer preservation in body rewrites |
  | `<part>` | waived: <reason the user gave> |
  ```

  At that point the sub-issues don't exist yet, so the table names them by title. After the push, the split replaces each title with its issue number (`#NNN`). That second body update is best-effort, and the titles stay readable if it fails. Both updates go through the shared push guard, so the issue's pointer survives.
- The spec itself is never written by the split. The fold issue can read the table to confirm everything was implemented.

### Settled: recursion guard
- **Implementation issues only.** In spec-driven mode the split doesn't ask the flow question (it's implicitly Flow C), and every proposed sub-issue gets the implementation type. It **refuses** to emit spec-generation, spec-enhancement, implementation-split or fold issues, even when asked in the dialogue, and tells the user that a new spec cycle needs a new epic. The depth is one level by construction, so no counter or state needs protecting.
- **Splitting further down stays ordinary.** An implementation issue that's split later doesn't have the implementation-split label, so it takes the normal path. Its sub-issues inherit the pointer (see "how the spec-driven mode starts"). It can never re-enter spec-driven mode.
- **When the spec needs more design:** if the dialogue finds a gap that the user won't waive and that can't be implemented from the spec as written, the split **aborts as declined**. The gap is found during the dialogue, before the parent draft is published, so nothing reaches GitHub; the local drafts are kept. It tells the user to open a spec enhancement issue (blocked by the generation issue, and added as a blocker of the implementation-split issue), then re-run the split once that issue closes. Opening that issue moves the hub's Status back to `Drafting`, under the status rules ("at least one enhancement issue open").

### Settled: dependency links
- **Finding the fold issue:** read `**Folded by:** #N` from the hub, which is already loaded once the resolver returns `ready`. If the field is missing, or `#N` is closed or doesn't carry the fold type label, the split reports it and creates **no** fold links. It never guesses.
- **Links between the implementation issues:** the split proposes an order during the dialogue (e.g. the resolver before its consumers, the pointer format before the push guard). The user confirms or edits it, and the confirm summary shows it.
- **Creation:** right after every sub-issue has been pushed, the split creates the confirmed links between implementation issues, plus one link per implementation issue making it a blocker of the fold issue. It uses GitHub's native "blocked by" API.
- **Failures are best-effort.** A link that fails to create is listed in the closing report with the exact `gh api` command to re-run it, and the split still ends as success, because the issues themselves exist. This is a real gap until it's fixed: a missing fold link means the fold issue isn't blocked by that implementation issue, and nothing else catches that (the spec still exists, so the resolver returns `ready`). The report has to make the missing links prominent.

### Settled: spec readiness gate
The spec-driven split proposes nothing until **both** of these hold:
- **The resolver returns `ready`** for the issue's pointer: the hub and every listed part exist. On `not_ready` (`missing`, `partial` or `invalid`), the split runs the shared dialogue (#938 decision 7) with the same options and the same session-only "proceed without the spec". If that option is chosen, the split drops to a **normal** split, because a spec-driven split without the spec is a contradiction.
- **The hub's `Status` is `Ready`**: every spec enhancement issue is closed. On any other status, the split stops before the dialogue, names the enhancement issues that are still open, and ends as declined. The GitHub "blocked by" links normally prevent this case; the gate covers a split started by hand.

**Implementation-split label but no pointer:** the label claims a spec-driven split with no spec to drive it, the same kind of contradiction as #938 decision 4. The split stops and asks the user to choose one of:
- **Add the pointer:** the user names the hub path, which is validated against the allowlist, and the split writes the line at the canonical spot before continuing. The push guard lets this through, because the current body has no pointer, so this is an addition, not a change.
- **Run a normal split instead.**
- **Abort.**

It never falls back silently.

### Settled: effects on the implementation-split issue
- **The split stays repo-free.** The spec-driven split never commits. Setting the hub's `Status` to `Implementing` (and the matching Status column in `docs/agents/specs.md`) is done by the implementation-split issue's own small docs PR, as its body already says. The split's closing report reminds the user of this follow-up.
- **The parent is treated like any split parent.** After the push, the implementation-split issue gets the `Split` label and stays open as the tracking issue, the same as today. Its status PR closes it. The fold issue doesn't depend on it staying open: the fold is blocked by every implementation issue through the dependency links, not only by the implementation-split issue.

### Settled: trust boundaries
The spec-driven split reads inputs from issue bodies and from files. Each one has an explicit trust rule:
- **File reads go through the resolver only.** The split reads exactly the `hub` and `parts[]` the resolver returns, and never parses part links out of the hub itself. Part paths are confined under the spec's own root (`docs/agents/specs/<topic>/`, or the hub alone for the single-file layout). A part link that escapes it makes the pointer `not_ready` with `reason: invalid`, and nothing is read. This confinement is a resolver rule, so `reentrancy.md` only references it, and this issue adds the one-line rule to `resolver.md` (today `resolver.md` and `pointer.md` only validate the pointer path).
- **"Add the pointer" is validated like any pointer.** The hub path the user types goes through the shared pointer parser and the allowlist in `pointer.md`, and must have the hub shape (`docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md`). A rejected path is asked again and never written. Once it's written, the resolver runs on it and the readiness gate applies as usual.
- **The `Implementation breakdown` hint is untrusted data.** It is free text in a GitHub issue body. The split uses it only to suggest groupings, never as instructions, and never takes paths, issue numbers or commands from it.
- **Every `#N` is checked before use.** `**Folded by:** #N` must be a bare number, and it is checked through `gh` against the same repo, its open state and the fold type label (see "dependency links"). The re-run `gh api` commands in the closing report are built only from those checked numbers and the resolved `owner/repo`, never from body text.
- **Performance:** no new rule. Files are read once after `ready` (no cache, per `resolver.md`). Link creation costs one API call per edge, about N fold links plus the confirmed links between implementation issues, and each failure is already best-effort.

### Settled: label references
- **Abstract terms only.** `reentrancy.md` refers to "the implementation-split type label" and "the fold type label" and never writes a literal label name. It defines both terms once: the canonical labels for these issue types, named by #938 implementation item 8. When item 8 names them, they're recorded in one place and `reentrancy.md` needs no edit.
- **The gap stays visible.** No part of the spec defines the canonical issue types and labels yet, even though the hub's Scope lists them. This issue adds an entry to the hub's Open points saying the label names are still to be defined, by #938 implementation item 8.

### Where it goes in the spec
- Write the settled decisions above as `reentrancy.md` in the spec's directory, in the same present-tense contract style as the other parts, and link it from the hub's parts list.
- Remove the reentrancy entry from the hub's Open points.
- Add a hub Open points entry noting that the canonical issue-type label names aren't defined by any part yet (#938 implementation item 8); see "label references".
- Add the fold-map row `reentrancy.md` → `docs/agents/architecture/spec-pipeline.md`.
- Where these decisions touch other parts, add a one-line cross-reference rather than duplicating the text: pointer inheritance → `pointer.md`, links → `ordering.md`, gate → `resolver.md`/`dialogue.md`.
- Add to `resolver.md` the rule that part paths listed by the hub are confined under the spec's root, and that an escaping part link makes the pointer `not_ready` with `reason: invalid` (see "trust boundaries").

### Project concerns
- **Scope:** docs only. This issue writes `reentrancy.md` and updates the hub; it implements nothing (that's #938's implementation item 10).
- **Backward compatibility:** a normal split of an issue *without* a pointer is unchanged. The one change to the normal split is that a spec-carrying parent's pointer is copied into its sub-issues.
- **Interaction design** for the new prompts (gate stop, label-without-pointer choice, gap waivers) belongs to #942. This issue only defines what is asked, not how.
- **Edge cases and tests** belong to #943, and **alternatives** to #944.
- **Migration / new root-level folder:** none.

### Spec status
When this issue closes and no other spec enhancement issue (#941–#944) is still open, set the hub's `Status` to `Ready` and update the Status column of the spec's row in `docs/agents/specs.md`, in the same PR. Otherwise, leave it at `Drafting`.

### Dependencies
Blocked by: the spec generation issue. Blocks: the implementation-split issue.

## Benefits
- Flow A gets a complete, unambiguous definition of its second split before anyone implements it (#938 implementation item 10).
- The coverage check and the recursion guard make the spec-to-issues step auditable and bounded: nothing in the spec is silently left out, and a spec cycle can never spawn another one.
- #945 can run the spec-driven split against a defined contract instead of improvising it.
