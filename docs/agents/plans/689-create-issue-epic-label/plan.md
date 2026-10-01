# Plan: Create-issue: Epic label

Issue: [689-create-issue-epic-label.md](../../issues/689-create-issue-epic-label.md)

## Overview

Add `Epic:fbca04` as an init-claude default label, ship two `next/` migrations that provision it (`001` repo: GitHub label, create-only-if-missing; `002` local: `init-claude-config.json` upsert-if-missing), register `Epic -> epic` as a non-actionable pipeline tag so label carryover stops copying it onto sub-issues/spawned issues, and make `mark-split` (called only by `arcanum-split-issue`'s finish step) also add `epic` to the split parent. Shell and native change together.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

The architect owns the docs follow-up (see "Docs (architect)" below).

## Shared contracts

- **Label**: name `Epic`, color `fbca04`, canonical tag `epic`. Appended to the end of `DEFAULT_LABEL_PAIRS` in both `init-claude/scripts/lib/label_config.sh` and `core/lib/services/LabelConfig.js` (same position in both, so parity/defaults specs agree).
- **Tag table**: `Epic -> epic` is added to `arcanum/_lib/tags.sh` (`_tag_label_for`, `_tag_for_label`, header comment table) and `core/lib/utils/issue/Tags.js` (`LABEL_TO_TAG`). It is **not** added to `ACTIONABLE_TAGS` (`core/lib/utils/issue/Tags.js`) nor to `arcanum/_lib/tag_actions.sh`'s `ACTIONABLE_TAGS`.
- **Carryover**: no code change needed in `LabelApplicator.js` / `spawn_issue_shell.sh` — both already strip every label that maps to a pipeline tag; adding `Epic` to the tables is what makes them strip it. Specs must prove it.
- **`mark-split`**: `arcanum/_lib/github_issue_shell.sh`'s `cmd_mark_split` and native `GithubIssueMark.markSplit` both perform, in this order: add `split`, add `epic`, remove `planning`. Each mutation is best-effort (a failure prints the same style of `Warning: could not add 'epic' tag to issue #<id> on <repo>` to stderr and does not fail the command). Adding `epic` when already present is a no-op on GitHub (idempotent). Stdout/exit code otherwise unchanged. `arcanum-split-issue`'s `finish_shell.sh` / `ArcanumSplitIssueFinish.js` need no change, since they already call `mark-split`.
- **Migrations** (`arcanum/migrations/repos/next/`): `migrations.json` gets two entries:
  - `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "repo"}`
  - `{"id": "002", "type": "script", "file": "002.sh", "skippable": true, "applies_to": "local"}`
  - Each script supports `config` (prints `{"skippable": true}`) and `run`, like `0.17.2/001.sh`; no prompt; runs with cwd = target repo root.
  - `001.sh run`: lists GitHub labels via `gh label list -R <repo_ref> --json name -q '.[].name'`; case-insensitive match on `Epic`; if found, prints `'Epic' label already present on <repo_ref>.` and does nothing else (never `gh label edit`); otherwise `gh label create Epic -R <repo_ref> --color fbca04` and prints `Created 'Epic' label on <repo_ref>.`.
  - `002.sh run`: if `.claude/state/init-claude-config.json` is missing, prints `No .claude/state/init-claude-config.json; skipping.`; if it already has an entry whose name equals `Epic` case-insensitively, prints `'Epic' already present in .claude/state/init-claude-config.json.`; otherwise calls `init-claude/scripts/write_label_config.sh add <config> Epic:fbca04` and prints `Added 'Epic:fbca04' to .claude/state/init-claude-config.json.`.
  - Each has a `NNN.md` description.

## Docs (architect)

After scripter and node land their changes:

- `docs/agents/architecture/issue-tags.md`: add the `epic | Epic` row and a short paragraph — non-actionable, stripped by carryover, added to a split parent by `mark-split`, provisioned by the `next/001`/`002` migrations.
- Regenerate `docs/agents/tag-mutations.md` via `scripts/generate_tags_table.sh` (the `mark-split` row picks up `epic` from `cmd_mark_split`), and confirm `scripts/check_tags_table.sh` passes.

## CI Checks

- `core/`: `make core-check` (CI jobs: `yarn test`, `yarn lint`; `yarn duplication` non-blocking)
- repo root: `scripts/check_tags_table.sh`, `scripts/test_generate_tags_table.sh`

## Notes

- The spec file `docs/agents/specs/arcanum-create-issue.md` (#688) is not yet on `main`; the decisions used here come from #688's issue body ("Epic and split-issue", "Migration", "Testing strategy").
- Out of scope: automation skipping Epics (#692), the native create command (#690), skill files (#691).
