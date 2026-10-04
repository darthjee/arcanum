# Repoint cross-skill references in other skills

Every other skill file that links to the moved steps must point at the new location. Keep the referenced section names ("Choosing the responsible agent(s)", "Dispatching") unchanged, since the content moved verbatim.

- `auto-fix-issue/steps/run.md` (~line 64): `../auto-fix-all/steps/handle_comment.md` → `../auto-resolve-issue/steps/handle_comment.md` (link text and target).
- `auto-fix-issue/steps/dispatch_agents.md` (~lines 47, 89): `auto-fix-all/steps/handle_comment.md` → `auto-resolve-issue/steps/handle_comment.md`.
- `discuss-issue/steps/discuss_and_save.md` (~line 177): `[auto-fix-all/steps/handle_comment.md](../../auto-fix-all/steps/handle_comment.md)` → `auto-resolve-issue/...`. The `../../auto-fix-all/scripts/checkout_from_main.sh` reference stays, because scripts don't move.
- `plan-issue/steps/write_and_confirm.md` (~line 189): same `handle_comment.md` repoint as above.
- `auto-monitor-issue-pr/steps/run.md` (line 3): "a nested caller like `auto-fix-all`'s `process_one_issue.md`" → "a nested caller like `auto-resolve-issue`'s `process_one_issue.md` (also run by `auto-fix-all`)".

Finally, grep the repo, excluding `core/node_modules`, `core/coverage`, `docs/agents/issues`, `docs/agents/plans` and `arcanum/migrations/`, for `auto-fix-all/steps/`. No skill file (`*/SKILL.md`, `*/steps/*.md`) may still reference it. Remaining hits in `docs/agents/**`, `README.md`, `.claude/agents/` and scripts belong to the architect and the scripter.

## Files to Change
- `auto-fix-issue/steps/run.md` — repoint `handle_comment.md` link
- `auto-fix-issue/steps/dispatch_agents.md` — repoint `handle_comment.md` mentions
- `discuss-issue/steps/discuss_and_save.md` — repoint `handle_comment.md` link
- `plan-issue/steps/write_and_confirm.md` — repoint `handle_comment.md` link
- `auto-monitor-issue-pr/steps/run.md` — update the nested-caller mention
