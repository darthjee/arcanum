# Mod Plan: Ship the arcanum-next-step mod (clear context + submit next command)

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces the **mod folder layout** and the **tool contract** exactly as in
  [plan.md](plan.md#shared-contracts) (names, error/success texts, toasts).
- `arcanum-next-step/.claude-plugin/types/` is engine-generated: add it to the root
  `.gitignore`; never commit it.
- Relies on `infra`'s `make mod-check` as the gate (until it exists, run the three
  commands directly).

## Steps

- [01 — Scaffold the mod and register the tool](mod/01-scaffold-and-register.md)
- [02 — Allowlist and validation](mod/02-allowlist.md)
- [03 — Scheduling, cancellation and failure handling](mod/03-scheduling.md)
- [04 — Tests](mod/04-tests.md)
- [05 — README](mod/05-readme.md)

## CI Checks

- `arcanum-next-step`: `make mod-check` (CI job: `mod-checks`).

## Notes

- API reference: the bundled `plugin-authoring` skill and the engine's
  `claude-code.d.ts` (grep it for `'turn.complete'`, `ToolCallResult`,
  `CommandRunArgs`, `AgentLoop`).
- Verify during implementation: whether `$` exposes interactive vs headless (edge
  case 8 — deny the tool headless if it does, else document); whether two installs
  both load the mod (edge case 10).
