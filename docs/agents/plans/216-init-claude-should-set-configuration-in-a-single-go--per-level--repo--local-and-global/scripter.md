# scripter Plan: Init claude should set configuration in a single go (per level, repo, local and global)

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section for the full picture. What you specifically must produce, for `skill-writer` to build its step file on top of:

- `init-claude/scripts/set_ci_ignored_patterns.sh --clear` — new clearing mode.
- Confirmation that `auto-fix-all/scripts/config.sh set <key> true|false` needs no changes (it already covers every case the new step needs).
- The exact `jq` read-side one-liners in `plan.md` work against the current file shapes — sanity-check them once you've made your changes, since you own the files they read.

## Implementation Steps

### Step 1 — Add `--clear` to `set_ci_ignored_patterns.sh`

Edit `init-claude/scripts/set_ci_ignored_patterns.sh`. Currently `[[ $# -lt 1 ]]` is always a usage error. Add a dedicated clearing path:

- If invoked as `set_ci_ignored_patterns.sh --clear` (exactly one arg, literally `--clear`): call `repo_config_write` with `PATTERNS_JSON='[]'` instead of building it from `$@`.
- Otherwise, keep today's behavior unchanged (`$# -lt 1` still errors, `$@` still builds the JSON array of patterns).

Update the script's header comment to document the new `--clear` usage line, mirroring the existing comment style.

### Step 2 — Drop the legacy-file fallback for the three keys

In `auto-fix-all/scripts/wait_ci.sh`, find the `repo_config_read` call for `ignored_check_patterns` (currently passes `.claude/configuration/auto-fix-all.json` as the legacy-file argument) and change that argument to `""` — `repo_config_read`'s existing `[[ -f "$legacy_file" ]]` check already treats an empty path as "no legacy file," so this cleanly disables the fallback for just this call site without touching `repo_config_read` itself.

In `auto-fix-all/scripts/config.sh`, `_legacy_file_for_key` currently returns `$STATE_CONFIG_FILE` for `clear_context|finish_on_empty_queue` and `$CONFIG_FILE` for every other key. Change the `clear_context|finish_on_empty_queue` branch to return `""` instead — leave the `*)` branch untouched, since other (hypothetical future) `auto-fix-all` keys read through `config.sh` should keep falling back normally; this issue's decision only covers these three keys.

Do **not** change `repo_config_write`/`repo_config_seed`'s legacy-seeding behavior (used on writes, e.g. inside `set_ci_ignored_patterns.sh` and `config.sh set`) — that's a write-time safety net, not the read-time fallback this issue's decision names. Leave it exactly as-is.

### Step 3 — Scaffold and fill in the two migration entries

Run `arcanum/migrations/generate_next.sh --type script` twice (from the arcanum install root) to get ids `001` and `002` under `arcanum/migrations/repos/next/`, appended to `arcanum/migrations/repos/next/migrations.json` with scaffolded defaults (`"skippable": true, "applies_to": "local"`).

Edit the two new entries in `migrations.json`:
- `001`: set `"applies_to": "repo"`, `"skippable": false`.
- `002`: keep `"applies_to": "local"`, set `"skippable": false`.

Fill in `001.sh`'s `cmd_run`:
```bash
repo_config_seed ".claude/configuration/arcanum-repo-config.json" ".claude/configuration/auto-fix-all.json" auto-fix-all
```

Fill in `002.sh`'s `cmd_run`:
```bash
repo_config_seed ".claude/state/arcanum-config.json" ".claude/state/auto-fix-all-config.json" auto-fix-all
```

Both `cmd_config` functions should still print `{"skippable": true|false}` matching the manifest value scaffolding leaves in place — actually, per `docs/agents/architecture/per-repo-migrations.md`, `cmd_config`/`NNN.sh config` is only consulted for **legacy, glob-discovered** entries; manifest-driven entries (which these are, since `next/migrations.json` already exists) get `skippable` from the manifest directly. Keep the `cmd_config` function present for consistency with the existing skeleton shape, but know it won't actually be read for these two entries — don't spend extra effort tuning it beyond matching the manifest value.

Write `001.md` and `002.md` (human-facing descriptions, shown at the `[R]un/[S]kip/[C]hat` prompt), explaining:
- What they do (re-seed the `auto-fix-all` namespace from the matching legacy file into the new namespaced file, same operation as `0.9.3/001.sh`).
- **Why they exist despite `0.9.3/001.sh` already doing this**: that migration is `skippable: true` and its own description states the runtime fallback is a permanent safety net for repos that skip it. This issue removes that fallback for `ignored_check_patterns`/`clear_context`/`finish_on_empty_queue`, so these two entries are the forcing function that guarantees every repo — regardless of whether it ever ran `0.9.3/001.sh` — has the data seeded forward before the fallback disappears. That's why these are `skippable: false` where the original was `true`.
- Safe to re-run (idempotent — `repo_config_seed` no-ops if the namespace already exists in the target file), same as `0.9.3/001.md` already documents for the same underlying operation.

### Step 4 — Update the doc pointer

In `docs/guides/arcanum-repo-config.md`, the "How to migrate" section names `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` as the files that "already write straight to the new files going forward." Update this to name whatever single merged step file `skill-writer` lands on instead (coordinate the final filename with `skill-writer`/`architect` before finalizing this edit — don't guess ahead of their actual file name).

## Files to Change

- `init-claude/scripts/set_ci_ignored_patterns.sh` — add `--clear` mode.
- `auto-fix-all/scripts/wait_ci.sh` — drop legacy-file argument for the `ignored_check_patterns` read.
- `auto-fix-all/scripts/config.sh` — drop legacy-file argument for `clear_context`/`finish_on_empty_queue` reads only.
- `arcanum/migrations/repos/next/migrations.json` — two new entries (`001` repo, `002` local), both `skippable: false`.
- `arcanum/migrations/repos/next/001.sh`, `001.md` — repo-tier re-seed migration.
- `arcanum/migrations/repos/next/002.sh`, `002.md` — local-tier re-seed migration.
- `docs/guides/arcanum-repo-config.md` — update the stale two-file pointer to the new merged step file's name.

## Notes

- No automated test suite covers these scripts today. Verify manually: (1) `set_ci_ignored_patterns.sh --clear` against a fixture repo with an existing `ignored_check_patterns` value, confirm it becomes `[]`; (2) `wait_ci.sh`/`config.sh get` against a fixture repo with values *only* in the legacy files, confirm they now return the default (no fallback) — this is the expected, intentional behavior change; (3) run `001.sh run` / `002.sh run` against that same legacy-only fixture, confirm the values land in the new namespaced files, then re-run both again to confirm idempotency (no error, no change).
- Coordinate the final merged step filename with `skill-writer` before writing Step 4's doc edit, so the doc doesn't reference a filename that doesn't exist.
