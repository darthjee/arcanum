# Node Plan: Add next_step.clear.* keys and CLEAR=true script protocol

Main plan: [plan.md](plan.md)

## Shared contracts

Implements the native side of every contract in [plan.md](plan.md#shared-contracts):
`next_step_prompt.sh` `CLEAR=true` + two-key notice, `auto_next.sh` forwarding, and
the `init-claude-set-next-step-clear` command (`NEXT_STEP_CLEAR=<skill>=<value>`).
Must stay byte-identical with the scripter's shell twins (parity specs).

## Steps

- [01 — CLEAR=true in NextStepPrompt](node/01-next-step-prompt-clear.md)
- [02 — Forward CLEAR=true in AutoPlanIssueAutoNext](node/02-auto-next-forward-clear.md)
- [03 — Shared writer base and InitClaudeSetNextStepClear](node/03-set-next-step-clear-command.md)
- [04 — Parity and dispatch specs](node/04-parity-and-dispatch-specs.md)

## CI Checks

- `core`: `make core-check` (or `cd core && yarn lint && yarn test`) — CI jobs `test`
  and `checks`.

## Notes

- Step 04 depends on the scripter's shell-twin changes; run it after them.
