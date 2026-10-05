# Issue: Auto-next: init-claude, migrations, remove spec

## Description

Part of #712, the last of its four sub-issues. #713 (spec), #714 (script and config) and #715 (skill wiring) are merged, so the `next_step.auto.<skill>` keys already work, but nothing helps users turn them on. This issue adds the two ways to set them, then retires the spec at `docs/agents/specs/skill-auto-next.md`.

The three keys are `next_step.auto.enhance-issue`, `next_step.auto.discuss-issue` and `next_step.auto.auto-plan-issue`. They are booleans that default to `false` and are read through `config_chain_read` (local state, then repo config, then global config).

## Problem

- The only way to enable auto-next today is to edit a config JSON file by hand.
- Existing repos get no prompt about the new keys when they upgrade.
- The spec is still in `docs/agents/specs/`, though most of its rules are already in the architecture docs: the script contract and the next-step map in `skill-finish.md`, and the namespace in `shared-state-and-configuration.md`. It is still linked from `auto-plan-issue/scripts/auto_next.sh`, and `shared-state-and-configuration.md` still says the wiring is "tracked by #715".

## Expected Behavior

- **init-claude** gets a new dedicated step (for example `init-claude/setup_auto_next.md`, run right after the `auto-fix-all` settings step). It asks for each of the three keys and writes the answers to **repo config** (`.claude/configuration/arcanum-repo-config.json`, committed), the tier the spec chose.
- **`/arcanum-migrate`** offers three opt-in, skippable migrations in `arcanum/migrations/repos/next/`, one per tier. They mirror `arcanum/migrations/repos/0.16.1/001`–`003` (`git.merge_body_mode`):
  - `applies_to: local` writes local state (`.claude/state/arcanum-config.json`, gitignored, per clone);
  - `applies_to: repo` writes repo config and warns first that the value will be committed and visible to every contributor;
  - `applies_to: global` writes global config (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`).

  Each migration prompts once per key on `/dev/tty` with `[Y]es/[N]o/[S]kip`. `[Y]es` writes `true`, `[N]o` writes an explicit `false`, and `[S]kip` leaves the key unset. An explicit `false` shadows a `true` in a lower tier, and the prompt says so. With no TTY the migration does nothing. All three are `type: script` and `skippable: true`, are registered in `next/migrations.json`, and each has its own `.md` summary.
- **`docs/agents/specs/skill-auto-next.md` is deleted.** Every rule that still matters lives in `docs/agents/architecture/`: the keys, the Epic rule, chained versus nested, branch safety, `/loop` chaining and how to enable the keys (the init-claude step and the three migrations). Nothing links to the spec any more.

## Solution

- **init-claude** (`skill-writer`): add a new `setup_auto_next.md` step to `init-claude/SKILL.md`, using the same review-and-confirm table pattern as `setup_auto_fix_all_settings.md`. Pre-populate each row from repo config, write only the rows that changed, and use `repo_config_write` with namespace `next_step` and dotted key `auto.<skill>`. Renumber the later steps and thread `REPO_PATH` through as the other settings steps do.
- **Migrations** (`scripter`): add `next/NNN.sh` and `next/NNN.md` for the local, repo and global tiers, using the next free ids in `next/`. They write with `repo_config_write` (local and repo) and `global_config_write` (global). Like every per-repo migration, they stay plain shell and need no native counterpart.
- **Docs** (`architect`):
  - Fold whatever is left of the spec (branch safety, `/loop` chaining, enabling through init-claude and the migrations) into `skill-finish.md#auto-next` and `shared-state-and-configuration.md#the-next_step-namespace`.
  - Fix the stale "#715" note and the `/auto-resolve-issue` wording, which should be `/loop /auto-resolve-issue`.
  - Point the header comment in `auto_next.sh` at the architecture doc.
  - Delete the spec and update the `docs/guides/arcanum-repo-config.md` and `README.md` mentions if needed.

## Benefits

- Users can turn auto-next on through the usual setup and upgrade flows, at whichever tier they want, instead of editing JSON by hand.
- Feature #712 is complete, and its design lives in the architecture docs instead of a forward-looking spec.
