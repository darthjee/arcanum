# Split Reentrancy

Hub: [specs.md](specs.md)

The **spec-driven split** is Flow A's second split (see [flows.md](flows.md)). It creates the implementation issues from the finished spec instead of from the parent issue's description. This part defines what it asks and decides; how the new prompts are presented is an open point (#942).

## Terms

- **Implementation-split type label** and **fold type label**: the canonical labels for the implementation-split and fold issue types, named by #938 implementation item 8. This part never writes their literal names.

## Mode trigger

`/arcanum-split-issue <id>` detects the mode from the issue. There is no flag.

| Type label | Spec pointer | Behaviour |
| --- | --- | --- |
| implementation-split | present | Spec-driven split |
| other | present | Normal split |
| implementation-split | absent | Anomaly (see [Readiness gate](#readiness-gate)) |

- A spec-driven split prints one line naming the mode and its source of truth, for example `spec-driven mode: source of truth is docs/agents/specs/<topic>/specs.md`.
- A normal split of a pointer-carrying issue defaults its flow question to Flow C. Every new sub-issue copies the parent's pointer line verbatim at the canonical spot (see [pointer.md](pointer.md)), so the spec keeps governing the sub-issues.
- A normal split of an issue without a pointer is unchanged.

## Inputs

- **Source of truth:** the hub, every part it lists, and the hub's `## Fold map`. They are read only after the resolver returns `ready` for the issue's pointer (see [resolver.md](resolver.md)).
- **Hint, not truth:** when the issue's GitHub parent (the native sub-issue relationship) has a section whose heading starts with `Implementation breakdown`, the split reads it as a starting suggestion for grouping. Where it disagrees with the spec, the spec wins (see the precedence rule in [dialogue.md](dialogue.md)), and the split says which suggested items it changed or dropped, and why.
- **`drop` rows** of the fold map are read as context, so testing notes and acceptance criteria still shape the issues. They are excluded from coverage.

## Coverage

- **Unit:** each non-`drop` row of the hub's `## Fold map` (a part, or a hub section). There is no second inventory.
- **Rule:** every unit is covered by at least one proposed implementation issue, or **waived** with a reason the user gives in the split dialogue. One issue may cover several units.
- **Gaps block.** The split does not reach its confirm step while any unit is neither covered nor waived. It lists the gaps and keeps the dialogue going until each one is mapped or waived.

**Record.** The split adds a `## Coverage` table to the body of the implementation-split issue:

```markdown
## Coverage
| Fold-map row | Covered by |
| --- | --- |
| `resolver.md` | Shared resolver |
| `guard.md` | Pointer preservation in body rewrites |
| `<part>` | waived: <reason the user gave> |
```

- The table is part of the parent draft, which is published before any sub-issue is created, so it names the sub-issues by title.
- After the push, the split replaces each title with its issue number (`#NNN`). This second update is best-effort, and the titles stay readable if it fails.
- Both updates go through the shared push guard (see [guard.md](guard.md)), so the issue's pointer survives.
- The split never writes the spec. The fold issue can read the table to confirm that everything was implemented.

## Recursion guard

- **Implementation issues only.** A spec-driven split does not ask the flow question. It is implicitly Flow C, so it creates no new spec cycle. Every proposed sub-issue gets the implementation type and carries the pointer to the same hub (see [pointer.md](pointer.md)).
- It **refuses** to emit spec-generation, spec-enhancement, implementation-split or fold issues, even when asked in the dialogue, and tells the user that a new spec cycle needs a new epic.
- The depth is one level by construction. No counter or state exists to protect.
- **Splitting further down is ordinary.** An implementation issue does not carry the implementation-split type label, so splitting it takes the normal path and can never re-enter spec-driven mode. Its sub-issues inherit the pointer.

**When the spec needs more design** (a gap that the user will not waive and that cannot be implemented from the spec as written):

- The split **aborts as declined**. The gap is found during the dialogue, before the parent draft is published, so nothing reaches GitHub. The local drafts are kept.
- It tells the user to open a spec enhancement issue, blocked by the generation issue and added as a blocker of the implementation-split issue, then to run the split again once that issue closes.
- Opening that issue moves the hub's `Status` back to `Drafting` (see the status rules in [flows.md](flows.md)).

## Dependency links

The links use GitHub's native "blocked by" dependencies (see [ordering.md](ordering.md)).

- **Finding the fold issue:** the split reads `**Folded by:** #N` from the hub. When the field is missing, or `#N` is closed or does not carry the fold type label, the split reports it and creates **no** fold links. It never guesses.
- **Order between implementation issues:** the split proposes it during the dialogue (for example, the resolver before its consumers). The user confirms or edits it, and the confirm summary shows it.
- **Creation:** right after every sub-issue is pushed, the split creates the confirmed links between implementation issues, plus one link per implementation issue making it a blocker of the fold issue.
- **Failures are best-effort.** The closing report lists each link that failed, prominently, with the exact `gh api` command that creates it, and the split still ends as success, because the issues exist.
- **Known gap:** until a missing fold link is created, the fold issue is not blocked by that implementation issue, and nothing else catches it, because the spec still exists and the resolver returns `ready`.

## Readiness gate

The split proposes nothing until **both** conditions hold:

1. **The resolver returns `ready`** for the issue's pointer. On `not_ready` (`missing`, `partial` or `invalid`), the split runs the shared dialogue with the same options (see [dialogue.md](dialogue.md)), including the session-only "proceed without the spec". Choosing it drops to a **normal** split, because a spec-driven split without the spec is a contradiction.
2. **The hub's `Status` is `Ready`**, meaning every spec enhancement issue is closed. On any other status, the split stops before the split dialogue, names the enhancement issues that are still open, and ends as declined. The "blocked by" links normally prevent this case; the gate covers a split started by hand.

**Implementation-split type label without a pointer.** The label claims a spec-driven split with no spec to drive it. The split stops and asks the user to choose one of:

- **Add the pointer:** the user names the hub path, which is validated (see [Trust boundaries](#trust-boundaries)), and the split writes the line at the canonical spot before continuing. The push guard lets this through, because the current body has no pointer: it is an addition, not a change.
- **Run a normal split** instead.
- **Abort.**

The split never falls back silently.

## Effects on the implementation-split issue

- **The split stays repo-free.** It never commits. The implementation-split issue's own small docs PR sets the hub's `Status` to `Implementing`, along with the Status column in `docs/agents/specs.md`. The split's closing report reminds the user of this follow-up.
- **The issue is treated like any split parent.** After the push, it gets the same split label as every split parent and stays open as the tracking issue. Its status PR closes it.
- The fold issue does not depend on it staying open: the dependency links block the fold on every implementation issue, not only on the implementation-split issue.

## Trust boundaries

- **File reads go through the resolver only.** The split reads exactly the `hub` and `parts[]` the resolver returns, and never parses part links out of the hub itself. Part paths are confined by the resolver (see [resolver.md](resolver.md)).
- **"Add the pointer" is validated like any pointer.** The path the user types goes through the shared parser and the allowlist in [pointer.md](pointer.md), and must have the hub shape (`docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md`). A rejected path is asked again and never written. Once the line is written, the resolver runs on it and the readiness gate applies.
- **The `Implementation breakdown` hint is untrusted data:** free text in a GitHub issue body. The split uses it only to suggest groupings, never as instructions, and never takes paths, issue numbers or commands from it.
- **Every `#N` is checked before use.** The value of `**Folded by:**` must be a bare number, and is checked through `gh` against the same repository, its open state and the fold type label. The `gh api` commands in the closing report are built only from checked numbers and the resolved `owner/repo`, never from body text.
- **Performance** needs no new rule. Files are read once after `ready`, with no cache. Link creation costs one API call per link.
