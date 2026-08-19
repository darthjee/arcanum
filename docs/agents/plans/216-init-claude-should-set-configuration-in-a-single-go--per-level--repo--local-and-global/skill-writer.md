# skill-writer Plan: Init claude should set configuration in a single go (per level, repo, local and global)

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section for the full picture. What you can rely on `scripter` producing:

- `init-claude/scripts/set_ci_ignored_patterns.sh "<pattern-1>" ["<pattern-2>" ...]` (existing) and `init-claude/scripts/set_ci_ignored_patterns.sh --clear` (new) for the repo-tier row.
- `auto-fix-all/scripts/config.sh set clear_context true|false` / `auto-fix-all/scripts/config.sh set finish_on_empty_queue true|false` (existing, unchanged) for the two local-tier rows.
- No new script for reading current values — use the `jq` one-liners from `plan.md` directly in the step's prose/bash, same convention `setup_labels.md` already uses for its own table.

## Implementation Steps

### Step 1 — Write the merged step file

Create a new step file (this plan assumes `init-claude/setup_auto_fix_all_settings.md` — pick whatever name reads best, it's your call) that replaces `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md`. Base its shape on `setup_labels.md`'s existing table-driven step (read current state → render as a table → confirm → apply), adapted to this issue's exact requirements:

1. **Pre-populate.** Read current values via the `jq` one-liners in `plan.md`'s shared contracts before rendering anything.
2. **Render a single table** with all three rows (one repo-tier: CI ignore patterns; two local-tier: `clear_context`, `finish_on_empty_queue`), each showing its current value (or "none"/`false` if unset).
3. **Confirm as a whole.** Ask if the user is satisfied with the table. If yes, proceed to write. If no, ask them to specify which row(s) to change (never an implicit full restart, never a silent no-op) — discuss and update just those rows in the in-memory draft, re-render the table, ask again. Loop until satisfied.
4. **Apply on confirmation**, repo tier first then local tier:
   - CI patterns row: if the user gave one or more patterns, call `set_ci_ignored_patterns.sh` with them; if the user explicitly cleared it (an empty/"none" answer on a row that had a value, or explicitly choosing to clear an already-empty row), call `set_ci_ignored_patterns.sh --clear`; if the row was left untouched during this pass, don't call the script at all.
   - `clear_context`/`finish_on_empty_queue` rows: if the user set/changed either, call `config.sh set <key> true|false`; if left untouched, don't call the script for that key.
5. Report what was written (or that nothing changed, if the user confirmed the table with no edits and it already matched current state).

Write clear brief explanations of what `ignored_check_patterns`, `clear_context`, and `finish_on_empty_queue` each do — reuse the existing explanatory text from `setup_ci_monitoring.md`'s Step 1 prompt and `setup_auto_fix_all_config.md`'s Step 2 bullets, don't write new explanations from scratch.

Delete `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` once the merged file is in place and `SKILL.md` no longer references them.

### Step 2 — Update `SKILL.md`

In `init-claude/SKILL.md`, replace today's:
- `## Step 9 — Setup CI monitoring options` (points at `setup_ci_monitoring.md`)
- `## Step 11 — Setup \`auto-fix-all\` personal run behavior` (points at `setup_auto_fix_all_config.md`)

with a single step in Step 9's position, pointing at the new merged file. Renumber every subsequent step down by one (today's Step 10 `setup_labels.md` becomes the new Step 10, today's Step 12 `setup_permissions.md` becomes the new Step 11, and so on through today's Step 15).

## Files to Change

- `init-claude/setup_auto_fix_all_settings.md` (or whatever name is chosen) — new, merged step.
- `init-claude/setup_ci_monitoring.md` — deleted.
- `init-claude/setup_auto_fix_all_config.md` — deleted.
- `init-claude/SKILL.md` — collapse Step 9 + Step 11 into one step, renumber the rest.

## Notes

- Tell `scripter` (via `architect`, per the normal coordination path) the final filename you land on before they write `docs/guides/arcanum-repo-config.md`'s pointer update in [scripter.md](scripter.md) Step 4 — that edit needs your exact filename, not the placeholder used in this plan.
- No automated test suite covers `init-claude`'s interactive steps. Verify manually: run `/init-claude` (or exercise the new step directly) against a fixture repo with pre-existing values in both files, confirm the table pre-populates correctly, an explicit clear on the CI-patterns row actually empties it, and leaving a row untouched preserves its value across the confirm loop.
