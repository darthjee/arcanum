# Issue: Auto-next: script and config

## Description

Part of #712. Implements the script side of auto-next and documents its config keys, following the merged spec [`docs/agents/specs/skill-auto-next.md`](../specs/skill-auto-next.md) (#713). Wiring the flags into the skills that make next-step offers is #715; the init-claude step and migrations are #716.

## Problem

Every interactive skill ends with a next-step offer from `arcanum/_lib/next_step_prompt.sh`, which always prompts on `/dev/tty` (or falls back to `AskUserQuestion` with exit 4). There is no way to opt in to skipping that offer and continuing automatically, and auto skills have no way to read the same decision without risking a prompt.

## Expected Behavior

`next_step_prompt.sh` (still plain bash, not engine-dispatched) gains two flags:

```text
next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... [--auto-key <skill>] [--no-prompt]
```

- **`--auto-key <skill>`** resolves `next_step.auto.<skill>` through `config_chain_read <repo_path> next_step auto.<skill>` (local state → repo config → global config).
  - Only the JSON boolean `true` enables it (`config_chain_read` prints compact JSON, so `true` and `"true"` are distinguishable). Absent, `null`, `false`, `"true"` or any other value counts as `false`.
  - When `true`: print `auto-continuing: <cmd> (next_step.auto.<skill>=true)` on **stderr** (`<cmd>` is the first `--command`, verbatim), print `CHOICE=yes` and `AUTO=true` on stdout, exit 0. `/dev/tty` is never probed.
  - Otherwise: behavior is exactly as today (TTY prompt, or exit-4 `FALLBACK=chat`).
- **`--no-prompt`** never prompts and never probes `/dev/tty`; prints `CHOICE=yes` or `CHOICE=no` from config alone and exits 0.
  - Without `--auto-key`: `CHOICE=no`.
  - With `--auto-key` and the key `true`: same output as `--auto-key` alone (notice on stderr, `CHOICE=yes`, `AUTO=true`).
- Argument validation runs first: unknown argument, missing `--repo`, no `--command`, or an empty / missing `--auto-key` value exit 1 before any config read or TTY probe.
- The existing output protocol is unchanged. `AUTO=true` is the only new stdout line and only appears with `CHOICE=yes`.
- `/arcanum-check-config next_step.auto.<skill>` resolves the keys (the command is already key-generic; this is a verification, not a code change).

## Solution

- `arcanum/_lib/next_step_prompt.sh`: parse the two flags, source `arcanum/_lib/config_chain.sh`, and add the auto/no-prompt branch between argument validation and the TTY probe. Update the header comment (usage, output table) accordingly.
- Specs in `core/spec/bin/nextStepPromptShell_spec.js` covering: key `true` / `false` / absent / string `"true"`; resolution from each tier (local, repo, global) and precedence; `--auto-key` with no TTY when the key is false (still exit 4); `--no-prompt` with and without `--auto-key`; notice on stderr only and stdout protocol intact; the new usage errors.
- Docs:
  - `docs/agents/architecture/skill-finish.md`: the next-step offer contract (new flags, `AUTO=true`, the stderr notice, `--no-prompt`). Updating the next-step map with which skills pass `--auto-key` is left to #715, which does the wiring.
  - `docs/agents/architecture/shared-state-and-configuration.md`: the `next_step` namespace.
  - `docs/guides/arcanum-repo-config.md`: a row per key (`next_step.auto.enhance-issue`, `next_step.auto.discuss-issue`, `next_step.auto.auto-plan-issue`), boolean, default `false`, local → repo → global.
  - `README.md` config table: the same keys.

### Acceptance criteria

- [ ] `next_step.auto.<skill>` is read through the 3-tier chain, defaults to `false`, and only JSON `true` enables it
- [ ] `--auto-key` skips the prompt (`CHOICE=yes`, `AUTO=true`, notice on stderr) when the key is true, and is unchanged otherwise
- [ ] `--no-prompt` never prompts or probes `/dev/tty`
- [ ] Usage errors still exit 1 before any config read or TTY probe
- [ ] Specs cover both flags
- [ ] The config docs list the new keys, and `/arcanum-check-config next_step.auto.<skill>` resolves them

## Benefits

- Lets users opt in, per hop, to running the enhance → discuss → plan → resolve pipeline without answering each offer.
- Gives auto skills a non-blocking way to read the same decision (`--no-prompt`).
- Default `false` keeps every existing flow unchanged.
