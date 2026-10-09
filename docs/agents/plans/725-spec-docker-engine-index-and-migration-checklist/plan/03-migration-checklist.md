# Migration checklist

Write `docs/agents/specs/docker/checklist.md`. Start with an intro covering:
- the purpose and the hand-maintenance rule;
- the column legend;
- that the repo mount is implicit for every row.

**Generate the skeleton once** with a one-off snippet (kept for the PR description, not committed):
- List every key of `arcanum/_lib/migration-status.json`.
- Grep every `engine_dispatch` call in `*/scripts/*.sh` and `arcanum/_lib/*.sh`, excluding `*_shell.sh` and `test_*`. From each call, take the command name (2nd argument), the shim path, the subcommand (the `case` branch, for routers) and the forwarded env vars (between the shell script argument and `--`).
- Flag native-only calls (`--native-only`).
- Cross-check: every `migration-status.json` key and every native-only command appears exactly once.

**Layout:**
- One `## <skill folder>` table per folder (`arcanum/_lib`, `auto-fix-all`, `discuss-issue`, ...).
- One row per dispatch command. Router shims produce several rows sharing a `script`.
- Columns: `command` | `script` | `kind` | `status` | `credentials` | `mounts` | `env` | `issue` | `notes`.

**Initial values:**
- `kind`: `dispatched` or `native-only`.
- `status`: ☐ everywhere. No `blocked (no native)` today, because every `migration-status.json` value is `true`. Verify this while populating.
- `credentials`: derived from the forwarded env allowlist (e.g. `HOME` forwarded → `gh`; `git-push (ssh)` for scripts that push). Review each row by hand; mark `?` when unsure.
- `mounts`: `?` (filled by #726).
- `env`, `issue`, `notes`: empty, except notes such as "TTY-owning" where obvious.

**Final section "Not routed through dispatch (pending #733)":**
- One row per file.
- Include every remaining `*.sh` under `*/scripts/` and `arcanum/_lib/`, excluding `*_shell.sh` and `test_*`, plus `arcanum/install/*` and `arcanum/update/*`.
- `command` is the file name; `kind` is `TBD (#733)`; `status` is `n/a`.

Do not write any count of rows/entrypoints in the doc.

## Files to Change
- `docs/agents/specs/docker/checklist.md` — new checklist.
