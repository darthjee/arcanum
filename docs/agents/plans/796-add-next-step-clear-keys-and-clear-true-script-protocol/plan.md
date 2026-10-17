# Plan: Add next_step.clear.* keys and CLEAR=true script protocol

Issue: [796-add-next-step-clear-keys-and-clear-true-script-protocol.md](../../issues/796-add-next-step-clear-keys-and-clear-true-script-protocol.md)

## Overview

Add the `next_step.clear.<skill>` keys and make the next-step scripts report them:
`next_step_prompt.sh` prints `CLEAR=true` after `AUTO=true` when both keys are JSON
`true`, and `auto_next.sh` forwards it after `CHAIN=yes` (shell twins and native
commands, in parity). `/init-claude` gains a `Clear` column and a
`set_next_step_clear.sh` writer sharing a base class with the auto writer. Purely
additive: output is byte-identical when the clear key is unset. No migration, no
skill-step behavior change (#798).

## Agents involved

- [node](node.md) — native `NextStepPrompt`, `AutoPlanIssueAutoNext`, the shared
  writer base + `InitClaudeSetNextStepClear`, command registry, all specs.
- [scripter](scripter.md) — shell twins (`next_step_prompt_shell.sh`,
  `auto_next_shell.sh`), the `set_next_step_clear.sh` shim, `migration-status.json`.
- [skill-writer](skill-writer.md) — `init-claude/setup_auto_next.md`.

Documentation (architect, done alongside or after the agents):
`docs/guides/arcanum-repo-config.md`, `docs/agents/architecture/skill-finish.md`,
`docs/agents/architecture/script-engine.md`,
`docs/agents/architecture/shared-state-and-configuration.md`.

## Shared contracts

**Clear key.** `next_step.clear.<skill>`, read through the 3-tier chain
(`config_chain_read` / `ConfigChain.read(repoPath, 'next_step', 'clear.<skill>')`),
local/repo tiers resolved under `--repo`. Only JSON `true` enables; any other value,
absence, or a read failure means disabled — never an error.

**`next_step_prompt.sh` (shell and native, byte-identical):**

- Clear key is read **only** when `--auto-key <skill>` is given **and** auto fired.
- Auto fired, clear `true`:
  - stdout: `CHOICE=yes\nAUTO=true\nCLEAR=true\n`, exit 0
  - stderr: `auto-continuing: <COMMANDS[0]> (next_step.auto.<skill>=true, next_step.clear.<skill>=true)\n`
- Auto fired, clear not `true` (or read failed): exactly today's output
  (`CHOICE=yes\nAUTO=true\n`, notice `auto-continuing: <cmd> (next_step.auto.<skill>=true)`).
- Every other path (`--no-prompt` → `CHOICE=no`, TTY yes/no/chat, `FALLBACK=chat`,
  usage errors) never emits `CLEAR`.

**`auto_next.sh` (shell and native):**

- `CHAIN=yes` and the prompt printed `CLEAR=true` → stdout `CHAIN=yes\nCLEAR=true\n`.
- Otherwise unchanged (`CHAIN=yes\n`, or `CHAIN=no\nREASON=branch|config|push\n`);
  `CLEAR` never follows `CHAIN=no`. Prompt's stderr notice still passes through.
- Parse `CLEAR=true` by line prefix, like `CHOICE=`.

**`set_next_step_clear.sh <repo_path> <skill> <true|false>`:**

- Native-only `engine_dispatch` shim → command `init-claude-set-next-step-clear`
  (`migration-status.json`: `"docker"`, same as `init-claude-set-next-step-auto`).
- Skills: `enhance-issue`, `discuss-issue`, `auto-plan-issue`; value literal
  `true|false`. Writes `next_step.clear.<skill>` into
  `.claude/configuration/arcanum-repo-config.json` via `RepoConfigWriter`.
- stdout `NEXT_STEP_CLEAR=<skill>=<value>\n`, exit 0. Usage/validation errors as
  `set_next_step_auto.sh` (same messages, with its own usage line
  `Usage: set_next_step_clear.sh <repo_path> <skill> <true|false>`).
- `set_next_step_auto.sh` / `init-claude-set-next-step-auto` unchanged in behavior,
  output and specs.

## Notes

- Edge cases to cover in specs (issue's table): 1 auto off + clear on, 2 mixed tiers,
  3 local `false` shadowing repo `true`, 4 non-boolean clear, 5 failing clear read
  keeps the auto result, 6 manual yes (no `CLEAR`), 9 `CHAIN=no` (no `CLEAR`).
- No `/arcanum-migrate` migration; skill-step prose is left to #798.
