# Skill-writer Plan: auto-resolve-issue: run a single auto-fix-all loop for one issue

Main plan: [plan.md](plan.md)

## Shared contracts

- Move `auto-fix-all/steps/process_one_issue.md` and `auto-fix-all/steps/handle_comment.md` to `auto-resolve-issue/steps/` with the **same file names** (use `git mv` to keep history).
- `process_one_issue.md`'s `OUTCOME=` protocol stays byte-for-byte the same. Both `auto-fix-all/SKILL.md` and the new `auto-resolve-issue/SKILL.md` parse it.
- Every script stays in `auto-fix-all/scripts/`, and `auto-fix-all/templates/reply.tmpl.md` stays put. The moved steps keep calling them, resolved relative to the `auto-fix-all` skill folder.

## Steps

- [01 — Move the per-issue steps into auto-resolve-issue](skill-writer/01-move-per-issue-steps.md)
- [02 — Write auto-resolve-issue/SKILL.md](skill-writer/02-write-auto-resolve-issue-skill.md)
- [03 — Turn auto-fix-all into a queue wrapper](skill-writer/03-rewire-auto-fix-all.md)
- [04 — Repoint cross-skill references in other skills](skill-writer/04-repoint-cross-skill-references.md)

## CI Checks

- `core/`: `yarn lint` and `yarn test` (CI jobs: `checks`, `test`). No Node code changes, but `core/spec/lib/utils/file/InstallRoot_spec.js` relies on `auto-fix-all/templates/reply.tmpl.md` still existing.
- Repo root: `scripts/check_tags_table.sh` (CI job: `build-and-release`), after the architect regenerates the table.

## Notes

- Deviation from the issue text: the issue listed `auto-fix-all/templates/reply.tmpl.md` among the files to move. It must **stay** in `auto-fix-all`. `auto-fix-all/scripts/reply_comment_shell.sh` reads it via `$SCRIPT_DIR/../templates/reply.tmpl.md`, `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` resolves it via `resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`, and `InstallRoot_spec.js` uses it as the install marker. It is script data, not a skill step.
- `ScheduleWakeup` only works under `/loop`. `auto-resolve-issue` must say so plainly when it hits `pending` outside a loop, same as `auto-fix-all`.
- Keep `clear_context` out of `auto-resolve-issue`.
