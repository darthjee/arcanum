# Add the opt-in migration notice

Add a migration entry to `arcanum/migrations/repos/next/` announcing the new opt-in `engine.mode` config key — use `arcanum/migrations/generate_next.sh --type script` to scaffold the id/files, then fill in:

- `migrations.json` entry: `type: "script"`, `applies_to: "local"` (shown once per clone — advisory only, not gated by the committed pointer), `skippable: true`.
- The script's `run` step prints a prominent notice — no file changes, so it's trivially idempotent/safe to re-run — covering:
  - Experimental & opt-in: enabling `engine.mode=native` today only activates a native path for `resolve-and-fetch`; every other entrypoint silently falls back to shell regardless, per `engine_dispatch.sh`'s fallback rule.
  - The key: `engine.mode` — values `shell` (default), `native`, `docker` (docker also falls back to shell today, per #192's scope).
  - Where to set it, resolved local → repo → global:
    - Local (gitignored, per clone): `.claude/state/arcanum-config.json` → `{"engine": {"mode": "native"}}`
    - Repo (committed, shared): `.claude/configuration/arcanum-repo-config.json` → `{"engine": {"mode": "native"}}`
    - Global (account/machine-wide): `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` → `{"engine": {"mode": "native"}}`

## Files to Change

- `arcanum/migrations/repos/next/migrations.json` — new entry.
- `arcanum/migrations/repos/next/<NNN>.sh` (new) — prints the notice on `run`, `{"skippable": true}` on `config` (only actually read for legacy glob-discovered entries, but keep it consistent with existing `NNN.sh` scripts' `config`/`run` shape).
