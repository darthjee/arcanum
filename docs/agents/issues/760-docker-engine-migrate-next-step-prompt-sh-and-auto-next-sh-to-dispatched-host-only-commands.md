# Issue: Docker engine: migrate next_step_prompt.sh and auto_next.sh to dispatched host-only commands

## Description

Part of epic #724. Decided in #733.

Two scripts are entrypoints that skills call directly, but they do not go through `arcanum/_lib/engine_dispatch.sh`:

- `arcanum/_lib/next_step_prompt.sh`: pure bash. It reads the config chain through `config_chain.sh`, which needs `jq`, and owns `/dev/tty` for the next-step prompt.
- `auto-plan-issue/scripts/auto_next.sh`: runs `next_step_prompt.sh --no-prompt` and then `git -C <repo> push`.

Because they are not dispatched, they always run as bash on the host, whatever `engine.mode` is.

## Problem

They are the only two `entrypoint`-kind rows left in `docs/agents/specs/docker/checklist.md`. They have no native implementation, so they can't be switched to native, and the checklist and `migration-status.json` can't describe them like every other command. They must still never run inside the container: there is no TTY there, so every next-step offer would turn into the `AskUserQuestion` fallback, and `git push` would lose the host's credentials.

## Expected Behavior

- Both become **dual entrypoints**: a native implementation in `core/`, the current bash moved to a `_shell.sh` twin (`next_step_prompt_shell.sh`, `auto_next_shell.sh`), and the original path turned into a thin `engine_dispatch` shim. Callers keep using the same paths and arguments.
- Dispatch command names follow the existing convention: `next-step-prompt` (shared `arcanum/_lib` command, under `core/lib/commands/shared/`) and `auto-plan-issue-auto-next` (under `core/lib/commands/auto-plan-issue/`).
- Their `arcanum/_lib/migration-status.json` value is `"host-only"`. Under `engine.mode=docker` they run native on the host, so `next_step_prompt.sh` keeps its real `/dev/tty` prompt and `auto_next.sh` pushes with the host's git credentials. Under `engine.mode=shell` nothing changes.
- stdout, stderr notices, exit codes, the `--auto-key` / `--no-prompt` behavior and the `FALLBACK=chat` exit-4 contract stay unchanged. The test-only `ARCANUM_TTY_DEVICE` override keeps working in both implementations.
- Their rows in `docs/agents/specs/docker/checklist.md` move from the "Not routed through dispatch" section (kind `entrypoint`) into their skill-folder tables as `dispatched` with status `n/a`, mounts `host-only`, and the reason in `notes`. The `entrypoint` kind is then unused.

## Solution

- **Native `next-step-prompt`**: reuse `core/lib/utils/config/ConfigChain.js` for the `next_step.auto.<skill>` read and `core/lib/utils/io/TtyPrompt.js` for the `/dev/tty` prompt.
- **Native `auto-plan-issue-auto-next`**: calls the native next-step-prompt logic in-process, not through the shim. `dispatch.md` requires that a native command calling a `host-only` shim be `host-only` itself, so it is `host-only` either way.
- Parity specs compare native with the `_shell.sh` twin: argument validation, auto-key enabled/disabled, `--no-prompt`, the no-TTY exit-4 fallback, and `auto_next`'s `branch` / `config` / `push` outcomes.
- Docs: update both scripts' header comments (they currently say "NOT engine-dispatched"), `docs/agents/specs/docker/dispatch.md` (the TTY section and the non-dispatched kinds table, which reference #760), the checklist intro and "Not routed through dispatch" section, `docs/agents/architecture/skill-finish.md` if it describes them as non-dispatched, and the entrypoint migration status page.

## Benefits

- Every skill-called entrypoint goes through `engine_dispatch`, which closes the last gap in epic #724's migration.
- Next-step prompts and the auto-plan push keep working on the host under `engine.mode=docker`, with the reason recorded in the checklist.
