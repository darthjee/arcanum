# Issue: Init claude should set configuration in a single go (per level, repo, local and global)

## Description
Right now, `/init-claude` configures Claude/Arcanum settings for a project through a series of individual y/n questions asked one at a time across separate steps (e.g. CI check-ignore patterns, `auto-fix-all`'s `clear_context`/`finish_on_empty_queue`). This issue consolidates the scalar/boolean configuration steps into a single table-driven review: all options presented together, confirmed once, then written — covering both the repo (committed) tier and the local (personal, gitignored) tier.

This does **not** cover `init-claude`'s content-drafting steps (`setup_folder_structure.md`, `setup_architecture.md`, `setup_contributing.md`, `setup_agents.md`, `setup_issue_enhancement.md`, `setup_arcanum_split_issue.md`, scenario files) — those produce free-form generated text reviewed conversationally, which doesn't fit a table. `setup_labels.md` (its own table + sync flow, already an intentional exception) and `setup_permissions.md` (writes to `.claude/settings.json` permissions, a different file) are also out of scope.

## Problem
- `setup_ci_monitoring.md` (repo tier — CI check-ignore patterns) and `setup_auto_fix_all_config.md` (local tier — `clear_context`/`finish_on_empty_queue`) each ask their own question(s) one at a time, in isolation, with no shared view of everything being configured.
- On a rerun, neither step shows the currently configured value first — the user re-answers from a blank slate, and an existing value can't easily be reviewed or cleared (`setup_ci_monitoring.md`'s "none" answer is a no-op today, not a clear — a previously set pattern list survives unchanged even when the user says "none" on a later run).
- Both steps still fall back to the pre-consolidation legacy files (`.claude/configuration/auto-fix-all.json`, `.claude/state/auto-fix-all-config.json`) via `repo_config_read`'s built-in fallback — lingering technical debt left over from the earlier `arcanum-repo-config.json`/`arcanum-config.json` migration.

## Expected Behavior
- A single step presents one table listing every scalar/boolean setting from both tiers — repo (`ignored_check_patterns`) and local (`clear_context`, `finish_on_empty_queue`) — pre-populated with whatever is currently configured (read from both `.claude/configuration/arcanum-repo-config.json` and `.claude/state/arcanum-config.json`).
- The user reviews the whole table and either confirms it as-is or names specific row(s) to change; changed rows are discussed and updated in place, then the table is re-shown and re-confirmed. This repeats until the user is satisfied.
- On confirmation, each row is written to its correct file/tier — repo tier first, then local tier (acceptable for these two writes to be independent; no transactional guarantee needed) — with clear per-row semantics: an explicit empty/"none" answer on a pre-populated row **clears** the stored value; leaving a row untouched **keeps** its current value unchanged.
- `repo_config_read`'s legacy-file fallback is dropped for these three keys. A migration entry copies any values still only present in the legacy files forward first, so no repo silently loses its configured behavior when the fallback goes away.

## Solution
- Merge `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` into one new step file covering both files' keys (exact filename is an open naming call — e.g. `setup_auto_fix_all_settings.md`); update `SKILL.md` to reference the single merged step instead of today's separate Step 9 / Step 11.
- The step stays agent-mediated — presented and confirmed in chat, **not** a `/dev/tty`-driven master script like `arcanum-migrate`. This keeps room for follow-up dialogue on individual rows, similar in spirit to how `setup_labels.md`'s refinement loop already works.
- Reads: pull current values from both `.claude/configuration/arcanum-repo-config.json` and `.claude/state/arcanum-config.json` (via `repo_config_read` or direct `jq`) before rendering the table.
- Writes: reuse `init-claude/scripts/set_ci_ignored_patterns.sh` and `auto-fix-all/scripts/config.sh set` for actual persistence — both already route through the namespaced files — just invoke them after the table is confirmed rather than immediately after each individual question, and extend them (or their call sites) to support an explicit "clear" write.
- Drop the legacy-file fallback for `ignored_check_patterns`/`clear_context`/`finish_on_empty_queue`: update `wait_ci.sh`/`config.sh` (and any other `repo_config_read` call sites for these keys) to stop passing the legacy file argument for them.
- Add a migration entry under `arcanum/migrations/repos/next/` that copies `.claude/configuration/auto-fix-all.json` / `.claude/state/auto-fix-all-config.json` values into the new namespaced files for these three keys specifically, mirroring the approach of the original legacy-file migration (`001.sh`).
- Update `docs/guides/arcanum-repo-config.md`'s "Re-run `/init-claude`" pointer to name the new merged step file instead of the two old ones.
- No automated test suite covers `init-claude`'s interactive steps today (no bats/spec coverage for this skill) — verification is manual: run `/init-claude` against a fixture repo with pre-existing (including legacy-only) values, and confirm the table pre-populates correctly, edits/clears apply as expected, and both files end up with the right content.

## Benefits
- One review-and-confirm pass instead of several separate y/n prompts — faster onboarding and less repetitive back-and-forth.
- Reruns become safe to use for auditing/adjusting existing configuration instead of blindly re-answering from scratch.
- Removes lingering legacy-file fallback debt for these three keys, backed by a migration so no repo's behavior silently changes.
