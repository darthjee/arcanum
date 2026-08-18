# Scripter Plan: Review agent tool-permission scopes and specialist-dispatch allowlisting

Main plan: [plan.md](plan.md)

## Shared contracts

Three new permission patterns to provision, one script per config tier, all under `arcanum/migrations/repos/next/`:

```
Bash(auto-fix-issue/scripts/commit_change.sh *)
Bash(auto-fix-issue/scripts/run_checks.sh *)
Bash(git add *)
```

| id | file | target | applies_to |
|----|------|--------|------------|
| 002 | `002.sh` | `.claude/settings.local.json` | `local` |
| 003 | `003.sh` | `.claude/settings.json` | `repo` |
| 004 | `004.sh` | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` | `global` |

`skill-writer` needs these exact three pattern strings for `init-claude/setup_permissions.md`'s new onboarding step — keep the strings identical between that step's `permission_grant.sh add` calls and these migrations.

## Implementation Steps

### Step 1 — Scaffold

Run `arcanum/migrations/generate_next.sh --type script` three times to scaffold ids `002`, `003`, `004` (it computes the next id itself from `arcanum/migrations/repos/next/migrations.json`, which currently ends at `001`). This creates skeleton `<id>.sh`/`<id>.md` pairs and appends default entries to `migrations.json`.

### Step 2 — Fill in `002.sh` (local tier)

Follow `arcanum/migrations/repos/0.16.0/001.sh` exactly as the template (same `cmd_config`/`cmd_run` shape, same `/dev/tty` interactive-Y/N-with-silent-skip-when-non-interactive gate — this loosens a security gate, so silence-on-non-interactive is the correct default, same as the existing shipit migrations). Differences from the template:
- `TARGET_FILE=".claude/settings.local.json"` (same as 001.sh).
- Three `PATTERN`s instead of one — three separate `permission_grant_add "$TARGET_FILE" "$PATTERN"` calls inside the `[Yy]*` branch, all three or none (single confirmation covers the bundle).
- Update the explanatory `echo` lines to describe the bundle: `auto-fix-issue/scripts/commit_change.sh` (every specialist's commit+push path), `auto-fix-issue/scripts/run_checks.sh` (every specialist's test/lint runner), and `git add` (staging, used immediately before the commit call) — reference issue #205 instead of #170, and note it does not exempt any other Bash command.
- `cmd_config` still prints `{"skippable": true}`.

Update the scaffolded `002.md` the same way `001.md` documents `001.sh` (see `arcanum/migrations/repos/0.16.0/001.md` as the template): what the migration grants, why, that it's local/not committed, and that skipping is harmless (specialists just keep hitting the classifier/escalation path).

### Step 3 — Fill in `003.sh` (repo tier)

Same as Step 2, but modeled on `arcanum/migrations/repos/0.16.0/002.sh`: `TARGET_FILE=".claude/settings.json"`, `applies_to: "repo"` in the manifest, and the explanatory text calls out that this is committed and shared with every contributor (same "Warning: this value will be committed..." line style as `002.sh`'s template). Update `003.md` from `0.16.0/002.md`'s template accordingly.

### Step 4 — Fill in `004.sh` (global tier)

Same again, modeled on `arcanum/migrations/repos/0.16.0/003.sh`: reuse that file's `_global_settings_file` helper verbatim (resolves `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`, warns and no-ops if unresolvable), `applies_to: "global"`, and explanatory text noting this applies across every arcanum-onboarded repo on this machine/account. Update `004.md` from `0.16.0/003.md`'s template accordingly.

### Step 5 — Fix up `migrations.json`

`generate_next.sh` scaffolds each entry with placeholder defaults (`"applies_to": "local"` for all three, per its own doc comment) — correct `003`'s and `004`'s `applies_to` to `"repo"` and `"global"` respectively (leave `002`'s as `"local"`). Leave `"skippable": true` and `"type": "script"` as scaffolded. Do not touch the existing `001` entry (unrelated, already pending).

## Files to Change

- `arcanum/migrations/repos/next/002.sh`, `002.md` — new (local-tier grant).
- `arcanum/migrations/repos/next/003.sh`, `003.md` — new (repo-tier grant).
- `arcanum/migrations/repos/next/004.sh`, `004.md` — new (global-tier grant).
- `arcanum/migrations/repos/next/migrations.json` — three new entries appended, `applies_to` corrected for `003`/`004`.

## Notes

- No shellcheck/lint CI job covers `arcanum/migrations/` in this repo — verify each script manually with `bash -n <file>` and a local dry run (`echo n | ./<id>.sh run` from a scratch clone, or similar) rather than relying on CI to catch a syntax error.
- Keep the three pattern strings byte-identical to what `skill-writer` writes into `init-claude/setup_permissions.md` — coordinate through `architect` if either side needs to change them.
