# Node Plan: Docker engine: migrate next_step_prompt.sh and auto_next.sh to dispatched host-only commands

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce `next-step-prompt` → `commands/shared/NextStepPrompt.js#run` (context `'none'`, parses `--repo` itself) and `auto-plan-issue-auto-next` → `commands/auto-plan-issue/AutoPlanIssueAutoNext.js#run` (context `'repo'`, `validateRepoPath: false`).
- Rely on the scripter for: the shell twins `arcanum/_lib/next_step_prompt_shell.sh` and `auto-plan-issue/scripts/auto_next_shell.sh` (the parity references), the shims, and `migration-status.json` set to `"host-only"` for both.
- Native env available under `env -i`: `CLAUDE_CONFIG_DIR`, `HOME`, `ARCANUM_TTY_DEVICE` (both commands), plus `GIT_CONFIG_GLOBAL`, `SSH_AUTH_SOCK`, `GIT_SSH_COMMAND` (auto-next).
- Output contracts unchanged: stdout lines, the stderr notice, exit codes 0/1/3/4 and `FALLBACK=chat` + `COMMAND=` lines. `AutoPlanIssueAutoNext` reuses `NextStepPrompt` in-process, never via the shim.

## Steps

- [01 — Native next-step-prompt](node/01-native-next-step-prompt.md)
- [02 — Native auto-plan-issue-auto-next](node/02-native-auto-next.md)
- [03 — Parity and dispatch specs](node/03-parity-and-dispatch-specs.md)

## CI Checks

- `core/`: `make core-test` / `make core-lint` (or `npm test` and `npm run lint` in `core/`, whichever the Makefile's `core-*` targets wrap).

## Notes

- `TtyPrompt` (`core/lib/utils/io/TtyPrompt.js`) already supports an injectable `device`. Wire `ARCANUM_TTY_DEVICE` from the env into it, as the bash does.
- Under docker, `host-only` means the command never runs in the container, so no `--needs` or `--path-arg` flags and no docker parity spec are needed.
