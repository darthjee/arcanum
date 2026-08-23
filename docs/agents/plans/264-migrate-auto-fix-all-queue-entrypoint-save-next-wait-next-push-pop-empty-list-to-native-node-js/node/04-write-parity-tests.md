# Write parity tests

Write `core/spec/bin/autoFixAllQueueParity_spec.js`, following the conventions already established in `core/spec/bin/autoFixAllConfigParity_spec.js`/`autoFixAllWaitCiParity_spec.js`: for each of the 7 subcommands, run the same inputs through both `queue_<subcommand>_shell.sh` (scripter's Step 1 output) and `core/bin/arcanum auto-fix-all-queue-<subcommand>` (this agent's Step 1/2 output), and assert identical stdout and exit code.

- `save`/`push`/`pop`/`empty`/`list`/`next` — straightforward same-input comparisons against a shared fixture queue state.
- `wait-next` — needs a bounded scenario on both sides (e.g. seed the queue non-empty so both resolve on the first check, or use a short/mockable poll setup) — same testing concern already solved for `auto-fix-all-wait-ci`'s parity test; never let this genuinely hang for 5s+ per poll.
- GitHub label mutation calls (`save`/`push`): mock/stub, no real network calls, per `docs/agents/architecture/script-engine.md`'s testing conventions — reuse `core/spec/support/fixtures/` the way other parity tests do.

Finally, verify (can be a manual/documented check rather than a new automated test, unless an existing precedent automates it) that `arcanum/_lib/engine_dispatch.sh` actually routes each of the 7 subcommands correctly for both `engine.mode=native` and `engine.mode=shell` once scripter's `migration-status.json` keys and this agent's `COMMANDS` entries are both in place — no changes to `engine_dispatch.sh` itself are expected, since it's already generic per-command.

## Files to Change

- `core/spec/bin/autoFixAllQueueParity_spec.js` — new, parity tests for all 7 subcommands.
