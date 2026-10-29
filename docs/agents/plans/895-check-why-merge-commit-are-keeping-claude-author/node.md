# Node Plan: Check why merge commit are keeping claude author

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the native side of the trailer builder:

- `core/lib/utils/git/CoauthorTrailers.js` (default export `CoauthorTrailers`), `constructor({ configChain, agentEmail, fileExists } = {})`, `async lines(repoPath, agent, modelName, modelEmail)` → `string[]`, implementing [plan.md](plan.md)'s "Trailer semantics" exactly (template engine → agent email, `omit` accepts `true`/`"true"`, model line only when not omitted, agent line dropped when `omit && agentEmail === modelEmail`).
- Message shape: the blank separator line before the trailers is emitted only when `lines()` returned at least one line.

You can rely on the scripter producing the byte-identical shell side (`coauthor_trailers` in `arcanum/_lib/agent_email.sh`, used by all four `*_shell.sh` commit scripts); the parity specs you update compare both.

## Steps

- [01 — Add the CoauthorTrailers helper](node/01-add-coauthor-trailers-helper.md)
- [02 — Refactor the three commit commands onto it](node/02-refactor-commit-commands.md)
- [03 — Use it in the cleanup command and update its specs](node/03-cleanup-artifacts.md)

## CI Checks

- `core`: `make core-test` and `make core-lint` (CI jobs: core test/lint in `.circleci/config.yml`); `make core-duplication` should improve, not regress, since three private copies go away.

## Notes

- Keep each command's constructor DI shape backward compatible (existing specs inject `configChain`/`agentEmail`); add an optional `coauthorTrailers` dep defaulting to `new CoauthorTrailers({ configChain, agentEmail })` so existing injections still flow through.
- `autoFixAllCleanupArtifactsParity_spec.js` currently applies no `HOME`/`CLAUDE_CONFIG_DIR` isolation; once cleanup reads config it must isolate the global tier like the other commit parity specs do, or results depend on the developer's real global config.
