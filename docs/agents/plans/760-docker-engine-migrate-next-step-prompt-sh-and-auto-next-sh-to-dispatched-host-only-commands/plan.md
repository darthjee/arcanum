# Plan: Docker engine: migrate next_step_prompt.sh and auto_next.sh to dispatched host-only commands

Issue: [760-docker-engine-migrate-next-step-prompt-sh-and-auto-next-sh-to-dispatched-host-only-commands.md](../../issues/760-docker-engine-migrate-next-step-prompt-sh-and-auto-next-sh-to-dispatched-host-only-commands.md)

## Overview

Turn `arcanum/_lib/next_step_prompt.sh` and `auto-plan-issue/scripts/auto_next.sh` into dual-entrypoint dispatched commands. Each gets a native implementation in `core/`, its current bash moves to a `_shell.sh` twin, and the original path becomes a thin `engine_dispatch` shim. Both are marked `"host-only"` in `migration-status.json`, so under `engine.mode=docker` they run native on the host, keeping the real `/dev/tty` prompt and the host's git push credentials. The output and exit-code contracts stay byte-for-byte unchanged.

## Agents involved

- [node](node.md): native commands, registry entries, unit specs, and parity specs.
- [scripter](scripter.md): shell twins, shims, the `migration-status.json` flip, the checklist and dispatch docs, and the regenerated status page.

## Shared contracts

**Dispatch commands** (registered in `core/lib/core/commands.js`):

| Command | Module | Method | context | Leading arg |
| --- | --- | --- | --- | --- |
| `next-step-prompt` | `commands/shared/NextStepPrompt.js` | `run` | `'none'` | none: the native side receives the raw flags (`--repo <path> --command <cmd>... [--auto-key <skill>] [--no-prompt]`) and parses `--repo` itself |
| `auto-plan-issue-auto-next` | `commands/auto-plan-issue/AutoPlanIssueAutoNext.js` | `run` | `'repo'`, `validateRepoPath: false` | `<repo_path>` positional (shim passes `--prepend-repo-path`, or forwards `"$@"` as-is with the repo path first; scripter and node must agree on one), then `<id>` |

`validateRepoPath: false` on `auto-plan-issue-auto-next` is needed because the shell original only checks that `<repo_path>` is a directory. A non-git directory answers `CHAIN=no` / `REASON=branch`, not an error.

**migration-status.json**: `"next-step-prompt": "host-only"` and `"auto-plan-issue-auto-next": "host-only"`.

**Shell twins**: `arcanum/_lib/next_step_prompt_shell.sh` and `auto-plan-issue/scripts/auto_next_shell.sh`. Each holds the current script body, unchanged except for header comments. `auto_next_shell.sh` keeps calling the **shim** `arcanum/_lib/next_step_prompt.sh` (path relative to its own dir, unchanged).

**Env forwarded to the native path** (the names listed before `--` in the shim's `engine_dispatch` call; native runs under `env -i`):
- `next-step-prompt`: `CLAUDE_CONFIG_DIR`, `HOME` (global config tier) and `ARCANUM_TTY_DEVICE` (test-only TTY override).
- `auto-plan-issue-auto-next`: the same three, plus what `git push` needs on the host: `GIT_CONFIG_GLOBAL`, `SSH_AUTH_SOCK` and `GIT_SSH_COMMAND`. Check the checklist's known `SSH_AUTH_SOCK` divergence note: if `SSH_AUTH_SOCK` is not forwarded, a native push over ssh can't use the agent.

**Shim argument handling for `next_step_prompt.sh`**: `engine_dispatch` needs the repo path first, but this script takes `--repo <path>` as a flag. The shim scans `"$@"` for `--repo <value>`:
- If it finds one and the value is a directory, it calls `engine_dispatch "<value>" next-step-prompt "<dir>/next_step_prompt_shell.sh" CLAUDE_CONFIG_DIR HOME ARCANUM_TTY_DEVICE -- "$@"`, with all args forwarded unchanged and no `--prepend-repo-path`.
- Otherwise it `exec`s `next_step_prompt_shell.sh "$@"`, so usage errors keep the exact shell message and exit 1 in every mode.

The native side must still validate `--repo` itself, with the same messages as the shell.

**Native in-process reuse**: `AutoPlanIssueAutoNext` calls the `NextStepPrompt` logic directly (same process, `--no-prompt`, `--auto-key auto-plan-issue`). It never shells out to the shim. Per `dispatch.md`, a native command that calls a `host-only` command must be `host-only` itself, and it is.

**Unchanged output contracts**: the stdout key=value lines, the stderr `auto-continuing: ...` notice, exit codes 0/1/3/4 and the `FALLBACK=chat` + `COMMAND=` lines, exactly as documented in the current script headers and `docs/agents/architecture/skill-finish.md`.
