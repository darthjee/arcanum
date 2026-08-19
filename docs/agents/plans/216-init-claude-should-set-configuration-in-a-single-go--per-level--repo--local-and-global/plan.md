# Plan: Init claude should set configuration in a single go (per level, repo, local and global)

Issue: [216-init-claude-should-set-configuration-in-a-single-go--per-level--repo--local-and-global.md](../issues/216-init-claude-should-set-configuration-in-a-single-go--per-level--repo--local-and-global.md)

## Overview

Merge `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` into a single chat-mediated, table-driven step that presents both the repo-tier (`ignored_check_patterns`) and local-tier (`clear_context`, `finish_on_empty_queue`) settings together, pre-populated from whatever is already configured, confirmed once, then written. Alongside the UX change, drop `repo_config_read`'s legacy-file fallback for these three keys, and ship two new non-skippable per-repo migration entries that force every repo — including ones that skipped the original, skippable `0.9.3/001.sh` seed migration — to catch up before the fallback disappears.

## Agents involved

- [skill-writer](skill-writer.md)
- [scripter](scripter.md)

## Shared contracts

**Config shape** (unchanged, just consolidated into one view):
- Repo tier — `.claude/configuration/arcanum-repo-config.json`, key `.["auto-fix-all"].ignored_check_patterns` (array of strings, absent = no patterns ignored).
- Local tier — `.claude/state/arcanum-config.json`, keys `.["auto-fix-all"].clear_context` and `.["auto-fix-all"].finish_on_empty_queue` (booleans, absent = `false`).

**New step file** (skill-writer creates, name is skill-writer's call — this plan assumes `init-claude/setup_auto_fix_all_settings.md`, adjust freely and update `SKILL.md`'s Step 9 reference accordingly): replaces today's `SKILL.md` Step 9 (`setup_ci_monitoring.md`) and Step 11 (`setup_auto_fix_all_config.md`) with one merged step. Delete both old files once merged.

**Pre-population (read side)** — no new script needed. The step reads current values directly via `jq` against both files (mirroring `setup_labels.md`'s existing `jq '.labels'` convention), defaulting to "none"/`false` when the file or key is absent:
```bash
jq -r '.["auto-fix-all"].ignored_check_patterns // [] | join(", ")' .claude/configuration/arcanum-repo-config.json 2>/dev/null
jq -r '.["auto-fix-all"].clear_context // false' .claude/state/arcanum-config.json 2>/dev/null
jq -r '.["auto-fix-all"].finish_on_empty_queue // false' .claude/state/arcanum-config.json 2>/dev/null
```

**Writes (write side) — script contract skill-writer's step calls, scripter implements:**
- Repo tier, set: `init-claude/scripts/set_ci_ignored_patterns.sh "<pattern-1>" ["<pattern-2>" ...]` (unchanged, existing script).
- Repo tier, clear: `init-claude/scripts/set_ci_ignored_patterns.sh --clear` (**new** — writes `[]` instead of erroring on zero args).
- Repo tier, leave unchanged: don't call the script at all.
- Local tier, set: `auto-fix-all/scripts/config.sh set clear_context true|false` / `auto-fix-all/scripts/config.sh set finish_on_empty_queue true|false` (unchanged).
- Local tier, leave unchanged: don't call the script at all (there is no boolean "clear" case — `false` already covers it via an explicit `set ... false`).
- Write order: repo tier first, then local tier (independent calls, no transactional guarantee needed per the issue's decision).

**Row semantics the step must implement** (from the issue's "Edge cases" section): an explicit empty/"none" answer on a pre-populated row is a real write that clears the value; a row the user doesn't mention on this pass keeps its current value unchanged — never silently reset to the hardcoded default.

**Legacy-fallback removal (scripter-only, no skill-writer involvement):** `repo_config_read`'s fallback to `.claude/configuration/auto-fix-all.json` / `.claude/state/auto-fix-all-config.json` is dropped specifically for `ignored_check_patterns`/`clear_context`/`finish_on_empty_queue`, at their two call sites (`auto-fix-all/scripts/wait_ci.sh`, `auto-fix-all/scripts/config.sh`). `repo_config_write`'s seed-on-first-write behavior is untouched — it's an unrelated write-time safety net, not the read-time fallback the issue's decision names.

**Migration (scripter-only):** two new entries in `arcanum/migrations/repos/next/migrations.json`, scaffolded via `arcanum/migrations/generate_next.sh --type script` (run twice, ids `001`/`002`), each re-running the same idempotent `repo_config_seed` call the original `0.9.3/001.sh` used, but this time `"skippable": false` — **this is a deliberate, notable change from that precedent**, because `0.9.3/001.sh`'s own description explicitly relies on the runtime fallback staying a "permanent safety net" for repos that skip it; this issue removes that safety net, so the seed itself must become mandatory instead.

## Notes

- This plan does not touch `setup_labels.md` or `setup_permissions.md` — both explicitly out of scope per the issue.
- No automated test suite covers `init-claude`'s interactive steps or `arcanum/migrations/` scripts today; verification is manual — see each agent's plan for its own check.
- Doc reference cleanup (`docs/guides/arcanum-repo-config.md`'s "Re-run `/init-claude`" pointer, which names the two old files by filename) is bundled into [scripter.md](scripter.md) rather than split into a third agent, since it's a one-line pointer update directly describing the config-file mechanics scripter already owns in this plan — not a `docs/agents/` or root-level file, so it isn't `architect`'s per its documented scope, and not a skill's own `SKILL.md`/`steps/*.md`, so it isn't `skill-writer`'s either.
