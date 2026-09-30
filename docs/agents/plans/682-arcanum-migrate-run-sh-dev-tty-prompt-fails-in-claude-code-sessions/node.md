# Node Plan: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

Main plan: [plan.md](plan.md)

## Shared contracts

- Pending + `ARCANUM_TTY_DEVICE` pointing to a nonexistent path → exit `4`, stdout lines `FALLBACK=chat`, `CURRENT=…`, `LOCAL=…`, `GLOBAL=…`, `PENDING=…` (≥1, ascending); `.claude/state/arcanum-errors.json` not created/reset.
- Up to date (same no-TTY env) → exit `0`, stdout contains `Up to date`, no `FALLBACK=`.
- `--repo` not a directory → exit `1`, empty stdout.

## Implementation Steps

### Step 1 — Contract spec for `run.sh`'s no-TTY fallback
Add `core/spec/bin/migrationsRunShell_spec.js`, modeled on `core/spec/bin/nextStepPromptShell_spec.js` (contract spec, not parity; header comment citing #682). Run `arcanum/migrations/run.sh` via `execFile` with `env` containing `ARCANUM_TTY_DEVICE=<tempDir>/missing-tty` and `CLAUDE_CONFIG_DIR=<tempDir>/claude` (never touch the real home config). Cases:
- **Pending versions**: temp repo with no config files (all pointers fall back to `0.0.0`, so every shipped version under `arcanum/migrations/repos/` is pending). Assert exit `4`, first stdout line `FALLBACK=chat`, `CURRENT=0.0.0`/`LOCAL=0.0.0`/`GLOBAL=0.0.0` lines, at least one `PENDING=` line, `PENDING=` values sorted ascending (semver compare), and that `<repo>/.claude/state/arcanum-errors.json` does not exist.
- **Up to date**: write `{"version":"999.0.0"}` to `<repo>/.claude/configuration/arcanum-repo-config.json`, `{"migrations":{"version":"999.0.0"}}` to `<repo>/.claude/state/arcanum-config.json` and to `<CLAUDE_CONFIG_DIR>/arcanum-config.json`. Assert exit `0`, stdout includes `Up to date` and not `FALLBACK=`. (Verify the exact config shapes against `arcanum/_lib/repo_config.sh` and `global_config.sh` before writing fixtures.)
- **Bad `--repo`**: `--repo <tempDir>/nope` → exit `1`, empty stdout.

## Files to Change
- `core/spec/bin/migrationsRunShell_spec.js` — new contract spec.

## CI Checks
- `core`: `make core-test` (CI job: `test`), `make core-lint` (CI job: `checks`)

## Notes
- Reuse `createTempDir`/`removeTempDir` from `core/spec/support/utils/tempDir.js`.
- If `global_config.sh` resolves differently from `CLAUDE_CONFIG_DIR`, adjust the fixture, not the script.
