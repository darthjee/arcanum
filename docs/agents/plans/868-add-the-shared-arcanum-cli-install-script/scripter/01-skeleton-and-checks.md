# Script skeleton and pre-npm checks

Create `arcanum/_lib/install_cli.sh` (executable, `#!/usr/bin/env bash`, `set -euo pipefail`) with a header comment in the style of `next_step_prompt_shell.sh`: purpose, usage, every env var (`ARCANUM_SKIP_CLI`, `ARCANUM_CLI_PROMPT`, test-only `ARCANUM_TTY_DEVICE` and the timeout seam), stdout keys, exit codes, and a pointer to `docs/agents/specs/cli-install.md`.

Implement:

1. **Argument parsing.** Exactly one positional `<version>` and an optional `--no-confirm`, in any order. Missing or extra arguments, or an unknown flag: usage error on stderr, exit `1`.
2. **Output helpers.** `_info <msg>` → `arcanum-cli: <msg>` on stderr; `_warn <reason>` → `arcanum-cli: warning: <reason>. Install it manually with: npm i -g arcanum-cli@<v>` on stderr. Keep the manual-command suffix overridable for the unpublished case (`npm i -g arcanum-cli`) and the newer-kept downgrade hint.
3. **`ARCANUM_SKIP_CLI`** (any non-empty value): info line, exit `0`, before anything else touches `node`/`npm`.
4. **Version validation.** Plain semver `MAJOR.MINOR.PATCH[-prerelease]` via a bash `[[ =~ ]]` regex (numeric parts without leading zeros; prerelease identifiers `[0-9A-Za-z-]` separated by dots; no build metadata). Invalid: warning, exit `0`, no `npm` call.
5. **TTY check.** Probe `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"` only when neither `--no-confirm` nor `ARCANUM_CLI_PROMPT=chat` is set (exact value `chat`). Unavailable: warning naming the manual command, exit `0`. Remember whether a TTY is available for step 03's prompt.
6. **Node and npm.** Both on `PATH` (`command -v`), else warning. Read `node --version`, strip the `v`, and compare against the constant `CLI_NODE_FLOOR="22.13.0"` (numeric `MAJOR.MINOR.PATCH` compare in bash is enough here); below it: warning naming the found and required versions.

`ARCANUM_ASSUME_YES` is never read.

## Files to Change

- `arcanum/_lib/install_cli.sh` — new script: header, argument parsing, output helpers, skip/validation/TTY/Node checks.
