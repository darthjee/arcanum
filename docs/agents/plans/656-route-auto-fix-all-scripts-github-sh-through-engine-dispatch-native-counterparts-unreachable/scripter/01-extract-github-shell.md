# Move the bash implementation into github_shell.sh

Create `auto-fix-all/scripts/github_shell.sh` with the current contents of `auto-fix-all/scripts/github.sh`: header, `GH_INSECURE_SKIP_VERIFY=true` export, sourced `_lib` helpers, every `cmd_*` function, the `repo_path_enter` case and the final dispatch/usage `case`. Behaviour must be unchanged, so only the header's first lines should say it's the shell implementation behind the `github.sh` shim. The parity specs run this file directly as the shell side.

Then add the 7 one-line wrappers listed in the shared contracts. Each is shaped exactly like `auto-fix-issue/scripts/github_shell_info.sh`:

```bash
#!/usr/bin/env bash
# <short header: shell side of auto-fix-all-github-<subcommand>, see github.sh>
set -euo pipefail
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_shell.sh" <subcommand> "$@"
```

Make all 8 new files executable.

## Files to Change
- `auto-fix-all/scripts/github_shell.sh` — new; the moved bash implementation.
- `auto-fix-all/scripts/github_shell_pr_number.sh`, `github_shell_pr_state.sh`, `github_shell_pr_merge.sh`, `github_shell_cleanup_branch.sh`, `github_shell_has_shipit_label.sh`, `github_shell_add_tag.sh`, `github_shell_remove_tag.sh` — new; one-line wrappers.
