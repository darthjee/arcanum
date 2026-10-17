# Scripter Plan: Add next_step.clear.* keys and CLEAR=true script protocol

Main plan: [plan.md](plan.md)

## Shared contracts

Implements the shell side of [plan.md](plan.md#shared-contracts): `CLEAR=true` and the
two-key notice in `next_step_prompt_shell.sh`, forwarding in `auto_next_shell.sh`,
and the `set_next_step_clear.sh` native-only shim. Output must be byte-identical to
the node agent's native commands.

## Implementation Steps

### Step 1 — Shell twins

- `arcanum/_lib/next_step_prompt_shell.sh`: inside the auto-fired branch, read
  `clear_value="$(cd "$REPO_PATH" && config_chain_read "$REPO_PATH" next_step "clear.${AUTO_KEY}" 2>/dev/null || true)"`.
  When `true`, print the two-key notice to stderr and `CHOICE=yes`, `AUTO=true`,
  `CLEAR=true` to stdout; otherwise today's notice and lines. Update the header's
  auto-mode and Output sections.
- `auto-plan-issue/scripts/auto_next_shell.sh`: capture `CLEAR=true` from
  `prompt_output` by line prefix (`grep -qx 'CLEAR=true'`); after a successful push
  print `CHAIN=yes` then `CLEAR=true` when set. Update the header's Flow and Output
  sections. `auto_next.sh` shim header: mention the new line if it restates the
  contract.

### Step 2 — `set_next_step_clear.sh` shim and engine status

- New `init-claude/scripts/set_next_step_clear.sh`, a copy of
  `set_next_step_auto.sh` dispatching
  `engine_dispatch "$REPO_PATH" init-claude-set-next-step-clear "" --native-only -- "$REPO_PATH" "$SKILL" "$VALUE"`,
  with its own usage line. Executable bit set.
- `arcanum/_lib/migration-status.json`: add
  `"init-claude-set-next-step-clear": "docker"` next to the auto entry.

## Files to Change
- `arcanum/_lib/next_step_prompt_shell.sh` — clear read, `CLEAR=true`, two-key notice, header.
- `auto-plan-issue/scripts/auto_next_shell.sh` — forward `CLEAR=true`, header.
- `auto-plan-issue/scripts/auto_next.sh` — header contract only, if it restates output.
- `init-claude/scripts/set_next_step_clear.sh` — new shim.
- `arcanum/_lib/migration-status.json` — new command status.

## CI Checks
- `core`: `make core-check` — the bin parity/dispatch specs exercise these scripts
  (CI jobs `test`, `checks`).

## Notes
- Do not change any existing output line or its order (backward-compatibility rule 1).
