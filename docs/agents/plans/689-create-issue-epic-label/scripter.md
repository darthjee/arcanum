# Scripter Plan: Create-issue: Epic label

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md) "Shared contracts" — this agent owns the shell side of: the default label, the tag table, `cmd_mark_split`, and both migration scripts/manifest/descriptions.

## Implementation Steps

### Step 1 — Default label, tag table, `mark-split`

- Append `Epic:fbca04` to `DEFAULT_LABEL_PAIRS` in `init-claude/scripts/lib/label_config.sh`.
- Add `epic <-> Epic` to `arcanum/_lib/tags.sh` (both `case` functions and the header table). Do not touch `arcanum/_lib/tag_actions.sh`'s `ACTIONABLE_TAGS`.
- In `arcanum/_lib/github_issue_shell.sh`'s `cmd_mark_split`: add `tag_mutate_add_label "$id" "$repo_ref" epic` (best-effort, with warning) between the `split` add and the `planning` remove. Update the usage/help strings for `mark-split` (in both `github_issue_shell.sh` and `github_issue.sh`) to "Add the Split and Epic labels and remove Planning, if present".
- Update any shell tests that assert the default label list or `mark-split`'s mutations (grep for `Spawned:6a737d` / `mark-split` under `init-claude/` and `arcanum/`).

### Step 2 — Migrations `next/001` and `next/002`

- Scaffold with `arcanum/migrations/generate_next.sh --type script` twice, then set `applies_to` to `repo` for `001` and `local` for `002` in `arcanum/migrations/repos/next/migrations.json`.
- `001.sh`: modeled on `arcanum/migrations/repos/0.17.2/001.sh`, but create-only-if-missing (no `gh label edit`), and no config upsert (that is `002`'s job). Messages per the shared contract.
- `002.sh`: config-only, per the shared contract; use `jq` to detect an existing case-insensitive `Epic` entry before calling `write_label_config.sh add`.
- `001.md` / `002.md`: human-readable descriptions (what it does, idempotent, why two entries — `.claude/state/` is git-ignored).
- Run `shellcheck` on all touched scripts.

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `Epic:fbca04`
- `arcanum/_lib/tags.sh` — add `epic`/`Epic`
- `arcanum/_lib/github_issue_shell.sh`, `arcanum/_lib/github_issue.sh` — `mark-split` adds `epic`; help text
- `arcanum/migrations/repos/next/migrations.json`, `001.sh`, `001.md`, `002.sh`, `002.md` — new migrations

## Notes

- The Jasmine spec exercising `001.sh`/`002.sh` is owned by `node` (`core/spec/bin/`); keep the stdout messages exactly as in the shared contract so that spec can assert them.
