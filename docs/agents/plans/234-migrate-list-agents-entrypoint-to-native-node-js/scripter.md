# scripter Plan: Migrate list-agents entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The renamed `list_agents_shell.sh` must keep byte-identical behavior to today's `list_agents.sh` — `node`'s parity test (`node/04-parity-test.md`) runs it directly. Coordinate the exact filename (`arcanum/_lib/list_agents_shell.sh`, matching the `checkout_safe_branch_shell.sh`/`resolve_and_fetch_shell.sh` naming convention) so the parity test's path matches.
- Only flip `"list-agents"` to `true` in `migration-status.json` after `node`'s unit + parity tests are landed and passing — flipping it earlier routes real `engine.mode=native` callers to an untested/nonexistent path.

## Steps

- [01 — Split list_agents.sh into a shell implementation and an engine_dispatch shim](scripter/01-split-shell-shim.md)
- [02 — Flip list-agents to true in migration-status.json](scripter/02-flip-migration-status.md)
- [03 — Regenerate the entrypoint migration status doc](scripter/03-regenerate-docs.md)

## Notes

- Steps 2 and 3 must happen after `node`'s work (node.md steps 1–4) is complete and its tests pass — this agent's own steps are otherwise independent of `node`'s and can start in parallel for Step 1.
