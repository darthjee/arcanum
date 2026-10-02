# Issue: Create-issue: remove spec

## Description
Part of #687, and the last sub-issue of that epic. It depends on #689, #690, #691 and #692, which have all shipped. `docs/agents/specs/arcanum-create-issue.md` was a temporary contract for those sub-issues. This issue deletes it and keeps the rules that still apply in `docs/agents/architecture/`.

## Problem
The spec's own Status says it is temporary and that #693 removes it. It also says "Proposed", even though everything in it has shipped. Six files still point to it:
- `arcanum-create-issue/scripts/start.sh` and `publish.sh` (header comments)
- `core/lib/commands/arcanum-create-issue/ArcanumCreateIssueStart.js`, `ArcanumCreateIssuePublish.js`, `IssueLabels.js` and `DraftStore.js` (JSDoc comments)

Most of its rules are already in architecture docs:
- **Epic tag**, split-parent handling, the label migration and the automation skip: [Issue Tags](docs/agents/architecture/issue-tags.md), `epic` paragraph
- **`shipit` rewording**: `issue-tags.md` and the generated `tag-mutations.md`
- **Closing report and Epic-based next step**: [Skill Finish](docs/agents/architecture/skill-finish.md)
- **Native-only pattern**: [Script Engine](docs/agents/architecture/script-engine.md)
- **`has-label` migration status**: [Entrypoint Migration Status](docs/agents/architecture/entrypoint-migration-status.md)
- **Exact `AskUserQuestion` wording**: `arcanum-create-issue/steps/*.md`

The `arcanum-create-issue` contract itself is only in the spec: draft location and lifecycle, the `start` and `publish` command keys and exit codes, label rules, and edge cases.

## Expected Behavior
- `docs/agents/specs/arcanum-create-issue.md` is deleted, and no file in the repo links to it. Old issue and plan files under `docs/agents/issues/` and `docs/agents/plans/` are historical and are left unchanged.
- The rules that still apply are documented under `docs/agents/architecture/`.

## Solution
- Add `docs/agents/architecture/arcanum-create-issue.md`. It is a short, standalone description of what has shipped, not a contract with sub-issue references. It covers:
  - **Draft file**: location `.claude/state/create-issue/<timestamp>.md`, the `# Title` rule, lifecycle (deleted only after a successful create), resume, no automatic cleanup, and no git use.
  - **Native commands** `arcanum-create-issue-start` and `arcanum-create-issue-publish`: arguments, `KEY=value` output keys, and exit codes `0`/`1`/`2`/`4`.
  - **Label rules**: `Writting` is the default, the suggested labels, any label is allowed, labels are matched case-insensitively with duplicates removed, missing labels are created (`Epic` as `fbca04`, others `ededed`), labels are set in a single create call, and `shipit` needs explicit confirmation.
  - **Edge cases**: the edge cases table, kept short.
  - **Links** to Issue Tags, Skill Finish and Script Engine for the rules already documented there. The `AskUserQuestion` wording stays in the skill steps.
- Add a row for the new file to `docs/agents/architecture.md`.
- Point the six code comments to the new doc.
- Delete the spec. Drop its Scope, Testing, Open points and per-sub-issue "Implemented in" notes, since they only described the epic's work.
- `docs/agents/specs/` stays, because `shell-engine-removal.md` is still there. `AGENTS.md` and `folder-structure.md` do not need changes.

## Benefits
- Arcanum no longer has a "Proposed" spec that describes code that has already shipped.
- The `arcanum-create-issue` contract has a permanent home next to the other architecture docs.

## Acceptance criteria
- [ ] `docs/agents/specs/arcanum-create-issue.md` is gone, and `git grep specs/arcanum-create-issue` finds nothing outside `docs/agents/issues/` and `docs/agents/plans/`.
- [ ] `docs/agents/architecture/arcanum-create-issue.md` exists and is listed in `docs/agents/architecture.md`.
- [ ] Every rule from the spec that still applies can be found under `docs/agents/architecture/`.
