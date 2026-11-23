# Write reentrancy.md

Create `docs/agents/specs/spec-first-split-flow/reentrancy.md`. Follow the conventions of the sibling parts (`ordering.md` and `guard.md` are good models): an H1 title, then `Hub: [specs.md](specs.md)`, then short `##` sections of present-tense bullets, with `**Rationale:**` lines only where a decision needs a reason. Link sibling parts by relative filename instead of restating their content.

Suggested title: `# Split Reentrancy (Spec-Driven Split)`. Sections and required content, all taken from the issue's "Settled" blocks:

1. **Purpose** (1 to 2 lines). Flow A's second split creates the implementation issues from the spec, not from the parent issue's prose. This is the implementation-split issue's step 3 in [flows.md](flows.md).

2. **Mode trigger**
   - `/arcanum-split-issue <id>` enters spec-driven mode when the issue carries the canonical implementation-split type label **and** a spec pointer ([pointer.md](pointer.md)). There is no flag.
   - It prints one line naming the mode and its source of truth: `spec-driven mode: source of truth is <hub path>`.
   - With a pointer but no label, it runs the normal split. The flow question defaults to Flow C, and every sub-issue copies the parent's pointer line verbatim to the canonical spot.
   - With the label but no pointer, it's an anomaly. See "Readiness gate".

3. **Inputs**
   - The source of truth is the hub, every part it lists, and the hub's `## Fold map`. They're read only after the resolver returns `ready` ([resolver.md](resolver.md)), so the no-read rule holds.
   - Hint: when the issue's GitHub parent (native sub-issue relationship) has a section whose heading starts with `Implementation breakdown`, that section is a starting suggestion only. The spec wins under the precedence rule ([dialogue.md](dialogue.md)), and the split reports which suggested items it changed or dropped, and why.
   - `drop` rows are read as context (testing notes and acceptance criteria still shape the issues) but are excluded from coverage.

4. **Coverage**
   - Unit: each non-`drop` row of the hub's `## Fold map` (a part or a hub section). There is no second inventory.
   - Rule: each unit is covered by at least one proposed implementation issue, or waived with a reason the user gives. One issue may cover several units.
   - Gaps block: the split can't reach its confirm step while any unit is neither covered nor waived. It lists the gaps and keeps the dialogue going.
   - Record: a `## Coverage` table (`| Fold-map row | Covered by |`) in the implementation-split issue's body, written as part of the parent draft published before the sub-issues are created. Include the issue's example table. Titles are replaced by `#NNN` after the push, best-effort (the titles stay readable on failure). Both body updates go through the shared push guard ([guard.md](guard.md)).
   - The split never writes the spec. The fold issue can use the table to confirm that everything was implemented ([fold.md](fold.md)).

5. **Recursion guard**
   - No flow question (implicitly Flow C). Every proposed sub-issue gets the implementation type.
   - It refuses to emit spec-generation, spec-enhancement, implementation-split or fold issues, even when asked, and tells the user that a new spec cycle needs a new epic. Depth is one level by construction, with no counter or state.
   - Splitting an implementation issue later takes the normal path (no implementation-split label), inherits the pointer, and can never re-enter spec-driven mode.
   - Spec needs more design: if the user won't waive a gap and the spec as written can't implement it, the split aborts as declined, before the parent draft is published. Nothing reaches GitHub and the local drafts are kept. It tells the user to open a spec enhancement issue (blocked by the generation issue, and a blocker of the implementation-split issue) and to re-run after that issue closes. Opening that issue moves the hub's Status back to `Drafting` under the status rules in [flows.md](flows.md).

6. **Dependency links** (the reentrancy edges that [ordering.md](ordering.md) defers here)
   - Fold issue: read from the hub's `**Folded by:** #N`. If it's missing, `#N` is closed, or `#N` lacks the fold type label, the split reports it and creates no fold links. It never guesses.
   - Links between implementation issues: the split proposes an order in the dialogue, the user confirms or edits it, and the confirm summary shows it.
   - Creation: right after every sub-issue is pushed, it creates the confirmed inter-issue links plus one "implementation issue blocks the fold issue" link each, through GitHub's native "blocked by" API.
   - Failures are best-effort. Each failed link is listed prominently in the closing report with the exact `gh api` command to re-run it, and the split still ends as success. State why this is a real gap: the resolver still returns `ready`, so nothing else catches a missing fold link.

7. **Readiness gate**
   - Resolver `ready` is required. On `not_ready` (`missing` | `partial` | `invalid`), run the shared dialogue ([dialogue.md](dialogue.md)) with the same options. Choosing "proceed without the spec" (session only) drops to a **normal** split.
   - Hub `Status` must be `Ready`. On any other status, it stops before the dialogue, names the still-open enhancement issues, and ends as declined. The "blocked by" links normally prevent this, and the gate covers a split started by hand.
   - Label but no pointer: stop and offer **add the pointer** (the user names the hub path, which is validated against the allowlist and written at the canonical spot; the push guard allows it because it's an addition, not a change), **run a normal split instead**, or **abort**. It never falls back silently.

8. **Effects on the implementation-split issue**
   - The split stays repo-free and never commits. Setting the hub `Status` to `Implementing`, and the Status column in `docs/agents/specs.md`, is done by the implementation-split issue's own docs PR. The closing report reminds the user of this follow-up.
   - After the push, the issue gets the `Split` label and stays open as the tracking issue, like any split parent. Its status PR closes it. The fold doesn't depend on it staying open, because the fold is blocked by every implementation issue directly.

9. **Open points** (short)
   - Interaction design for the gate stop, the label-without-pointer choice and gap waivers: #942.
   - Edge cases and tests: #943.

## Files to Change

- `docs/agents/specs/spec-first-split-flow/reentrancy.md` — new spec part holding the settled reentrancy contract.
