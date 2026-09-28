# Close the shell-only catch-all in auto-fix-issue/scripts/github.sh

`auto-fix-issue/scripts/github.sh` ends with `*) exec bash "${SCRIPT_DIR}/github_shell.sh" "$@"`. That's dead code today, because `info`, `pr-create`, `pr-view` and `pr-ready` are all dispatched, but it would let a future subcommand quietly skip `engine_dispatch`. Replace it with a usage error: print the header's usage lines to stderr and exit 1. That matches what `github_shell.sh` already does for an unknown subcommand, so the observable behaviour for unknown or missing subcommands is unchanged (stderr usage, exit 1).

## Files to Change
- `auto-fix-issue/scripts/github.sh` — `*)` branch becomes a usage error instead of `exec … github_shell.sh`. Adjust the header comment if it mentions the fallthrough.
