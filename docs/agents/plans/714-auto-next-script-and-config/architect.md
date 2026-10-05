# Architect Plan: Auto-next: script and config

Main plan: [plan.md](plan.md)

## Shared contracts

You document the CLI behavior and the three keys in [plan.md § Shared contracts](plan.md#shared-contracts). Use the exact notice text, the `AUTO=true` line, the validation order, and the "only JSON `true`" rule.

## Implementation Steps

### Step 1 — Next-step offer contract

In `docs/agents/architecture/skill-finish.md` § Next-step offer:

- Usage line with `[--auto-key <skill>] [--no-prompt]`.
- New subsection "Auto-next": how `--auto-key` reads `next_step.auto.<skill>` through `config_chain_read`, the stderr notice, the `CHOICE=yes` + `AUTO=true` output, no TTY probe, and `--no-prompt` (for auto skills; `CHOICE=no` unless the key is enabled).
- Output protocol table: add the auto row and the `--no-prompt` row; add the empty `--auto-key` value to the usage-error row.
- Skill-side rules: `CHOICE=yes` with `AUTO=true` is handled like `[Y]es` (chained run), and the skill relays the notice to the user.
- Leave the Next-step map unchanged (which skills pass `--auto-key` is #715). Keep the spec `docs/agents/specs/skill-auto-next.md` in place; #716 removes it.

### Step 2 — Config docs

- `docs/agents/architecture/shared-state-and-configuration.md`: describe the `next_step` namespace (`next_step.auto.<skill>`, boolean, default `false`, read through `config_chain_read` across all three tiers, only JSON `true` enables), and add `next_step.auto.<skill>` to the list of keys wired into the chain; add it to the repo-config and local-state shapes.
- `docs/guides/arcanum-repo-config.md` § Documented keys: one row each for `next_step.auto.enhance-issue`, `next_step.auto.discuss-issue`, `next_step.auto.auto-plan-issue` (boolean, `false`, local → repo → global, the offer it skips).
- `README.md` config table and the "every key together" JSON example: the same three keys.
- Run `/arcanum-check-config next_step.auto.discuss-issue` (or `arcanum-check-config/scripts/check_config.sh <repo> next_step.auto.discuss-issue`) to confirm it resolves; no code change expected.

## Files to Change

- `docs/agents/architecture/skill-finish.md` — flag contract, output table, skill-side rule.
- `docs/agents/architecture/shared-state-and-configuration.md` — `next_step` namespace.
- `docs/guides/arcanum-repo-config.md` — the three keys.
- `README.md` — config table and example.

## Notes

- Mention that the keys are honored only once #715 wires them into the skills, so the docs don't overpromise in the meantime.
