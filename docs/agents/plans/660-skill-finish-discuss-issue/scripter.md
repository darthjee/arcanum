# Scripter Plan: Skill finish: discuss-issue

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the shell side of `finish_report.sh`, with the CLI, report format, `--nested` block, `--merge` rules, label mapping, `ssh.github.com` → `github.com` web-domain mapping and exit codes defined exactly as in [plan.md](plan.md#shared-contracts). You also produce `next_step_prompt.sh` with the prompt/stdout/exit-code protocol there. node builds a byte-identical native `finish-report`, and its parity spec runs your `finish_report_shell.sh` directly. skill-writer calls both scripts from `discuss-issue`.

## Steps

- [01 — finish_report_shell.sh](scripter/01-finish-report-shell.md)
- [02 — finish_report.sh shim](scripter/02-finish-report-shim.md)
- [03 — next_step_prompt.sh](scripter/03-next-step-prompt.md)

## CI Checks

- `core` (parity spec also exercises your shell script): `cd core && yarn test` (CI job: tests)
- Shell: `shellcheck` on the new scripts. Keep the header-comment style of the existing `_shell.sh` scripts.

## Notes

- Follow the existing `arcanum/_lib/*_shell.sh` conventions: `set -euo pipefail`, source `origin.sh` / `tags.sh` via `SCRIPT_DIR`, and take `repo_path` as a required first argument.
- Do not add `finish-report` to `migration-status.json` yourself; node flips it to `true`. Until then, `engine_dispatch` falls back to shell with a warning, which is expected.
