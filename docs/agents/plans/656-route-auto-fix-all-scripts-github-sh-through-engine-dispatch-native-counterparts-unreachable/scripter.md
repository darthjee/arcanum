# Scripter Plan: Route auto-fix-all/scripts/github.sh through engine_dispatch (native counterparts unreachable)

Main plan: [plan.md](plan.md)

## Shared contracts

You produce everything in [plan.md](plan.md)'s "Shared contracts": `github_shell.sh`, the 7 `github_shell_<subcommand>.sh` wrappers, the new `github.sh` shim, the usage-error `*)` branch in both GitHub shims, the direct `github_shell.sh pr-merge` call in `wait_ci_and_merge_shell.sh`, and the 7 per-subcommand map keys. node relies on the file names and the key names exactly as listed there.

## Steps

- [01 — Move the bash implementation into github_shell.sh](scripter/01-extract-github-shell.md)
- [02 — Rewrite github.sh as an engine_dispatch shim](scripter/02-github-shim.md)
- [03 — Close the shell-only catch-all in auto-fix-issue/scripts/github.sh](scripter/03-auto-fix-issue-catch-all.md)
- [04 — Per-subcommand migration-status.json keys](scripter/04-migration-status-keys.md)

## Notes

- Model everything on `auto-fix-issue/scripts/github.sh`, `github_shell.sh` and `github_shell_info.sh`, including the shim's header comment explaining why the wrappers exist (native wants `<repo_path> [rest]`, while `github_shell.sh` wants `<subcommand> <repo_path> [rest]`).
- Keep all files bash 3.2 compatible and shellcheck clean, like their siblings.
- Callers in skill markdown (`auto-fix-all/SKILL.md`, `auto-fix-all/steps/*.md`) keep calling `scripts/github.sh <subcommand> ...`, so no skill-writer work is needed.
