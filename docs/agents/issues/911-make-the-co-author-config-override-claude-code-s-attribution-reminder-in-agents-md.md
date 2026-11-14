# Issue: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

## Description

Part of #900.

Arcanum's commit scripts (`core/lib/utils/git/CoauthorTrailers.js`, `arcanum/_lib/agent_email.sh`) already apply `git.omit_model_coauthor` and `git.remove_coauthors`. Claude Code's own attribution reminder, though, asks for a `Co-Authored-By: Claude … <noreply@anthropic.com>` line on every commit Claude writes by hand. The reminder defers to the user's own instructions (CLAUDE.md/AGENTS.md), so a single line in AGENTS.md can make hand commits follow the arcanum config too.

## Problem

- A commit Claude writes by hand (outside arcanum's commit scripts) follows the attribution reminder, not the arcanum config. With `git.omit_model_coauthor: true` or an email listed in `git.remove_coauthors`, the hand commit still adds the trailer (seen in the ward session).
- Nothing in a repo's AGENTS.md tells Claude that the arcanum config governs commit trailers.

## Expected Behavior

- After `/init-claude`, the repo's AGENTS.md has one line saying that commit co-author trailers follow the resolved `git.omit_model_coauthor` / `git.remove_coauthors` values (checkable with `/arcanum-check-config`), and that this overrides Claude Code's attribution reminder.
- The line is a **static pointer**: it names the keys, not their values. The keys can differ per machine (local and global tiers), while AGENTS.md is committed.
- The line covers **commit trailers only**. PR body attribution (the "Generated with Claude Code" line) is out of scope.
- Re-running `/init-claude` or the migration never duplicates the line.
- Existing repos get the line through `/arcanum-migrate`.

## Solution

1. **Shared script** (scripter): add an idempotent script under `arcanum/_lib/`. It takes `REPO_PATH` and appends the co-author line to `AGENTS.md` only when the line is missing. The init-claude step and the migration both call it, so the wording lives in one place.
2. **init-claude step** (skill-writer): add `init-claude/setup_coauthor_policy.md`, run from `init-claude/SKILL.md` after the scenario step for every scenario. It calls the shared script with `REPO_PATH`. The 8 `scenario_*.md` files stay unchanged.
3. **Migration** (scripter): add a `next` repo-scoped, skippable migration (`arcanum/migrations/repos/next/004.sh` + `004.md`, registered in `migrations.json`). It calls the shared script, and does nothing when the repo has no `AGENTS.md`.
4. **arcanum's own AGENTS.md** (architect): add the same line.
5. Document the line in the relevant docs (e.g. `docs/guides/arcanum-repo-config.md` next to the two keys).

## Benefits

- Hand commits respect `git.omit_model_coauthor` / `git.remove_coauthors` the same way script commits do.
- One wording source, shared by init and migration.
- Existing repos catch up through the normal migration flow.
