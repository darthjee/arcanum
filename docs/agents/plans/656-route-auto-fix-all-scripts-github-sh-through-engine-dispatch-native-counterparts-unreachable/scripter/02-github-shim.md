# Rewrite github.sh as an engine_dispatch shim

Replace `auto-fix-all/scripts/github.sh` with a thin router modelled on `auto-fix-issue/scripts/github.sh`:

- Header comment: what the shim does, why the per-subcommand wrappers exist, why `HOME` is forwarded, the usage lines for all 7 subcommands, and "output and exit code: unchanged — see github_shell.sh".
- `source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"`, then `SUBCOMMAND="${1:-}"` and `REPO_PATH="${2:-}"`.
- A `case "$SUBCOMMAND"` with one branch per subcommand:
  `engine_dispatch "$REPO_PATH" auto-fix-all-github-<subcommand> "${SCRIPT_DIR}/github_shell_<subcommand>.sh" HOME -- "${@:2}"`.
- An `*)` branch that prints the same usage text `github_shell.sh` prints to stderr and exits 1. There is **no** `exec github_shell.sh "$@"` fallthrough.

Also point `auto-fix-all/scripts/wait_ci_and_merge_shell.sh` at `"${SCRIPT_DIR}/github_shell.sh" pr-merge "$REPO_PATH" "$MODEL_EMAIL"` instead of `github.sh`, and update its header comments that mention `github.sh pr-merge`. The shell implementation then never re-enters `engine_dispatch`.

## Files to Change
- `auto-fix-all/scripts/github.sh` — rewritten as the per-subcommand `engine_dispatch` shim.
- `auto-fix-all/scripts/wait_ci_and_merge_shell.sh` — call `github_shell.sh pr-merge` directly, and update its comments.
