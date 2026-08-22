# node Plan: Migrate spawn-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Register `spawn-issue` in `core/bin/arcanum`'s `COMMANDS` registry, routed to `core/lib/SpawnIssue.js#run`.
- `run(repoPath, parentId, title, bodyFile, asSubissueFlag)` args mirror the shell script's own `<repo_path> <parent_id> <title> <body_file> [--as-subissue]`, unchanged — the shim (scripter) passes them straight through.
- Output: `STATUS=ok\nID=<new_id>\nURL=<url>\n` on success (returned as a string, printed by the router as usual); `STATUS=failed\n` printed to stdout **and** exit code 1 on retry exhaustion — this second shape needs a new router mechanism (step 01) since every prior migrated entrypoint's failure path was either a `STATUS=error` string at exit 0, or a thrown `Error` (stderr + exit 1) — never both a stdout line and a non-zero exit together.
- Depends on #237/PR #248 (`GithubIssue.js#create(repoPath, title, file)`, returning `ID=/TITLE=/FILE=/DOMAIN=/REPO=` or throwing) — call it directly as a JS import (in-process), not by shelling out to `core/bin/arcanum github-issue-create`.

## Steps

- [01 — Extend the dispatch router for a stdout-plus-exit-1 result](node/01-extend-dispatch-router.md)
- [02 — Add retry-tuning config reads to RepoConfig](node/02-repoconfig-retry-tuning.md)
- [03 — Implement SpawnIssue.js and wire it into the CLI](node/03-implement-spawnissue.md)
- [04 — Unit tests for SpawnIssue.js](node/04-unit-tests.md)
- [05 — Shell/native parity test](node/05-parity-test.md)

## CI Checks
- `core`: `yarn test` (CircleCI job: `test`)
- `core`: `yarn lint` (CircleCI job: `checks`)

## Notes
- Do not start implementation until #237 (PR #248) is merged — `GithubIssue.js#create` and the `github-issue-create` routing key are a hard dependency.
- `core/lib/RepoPath.js` (validation) and `core/lib/Tags.js` (`extractTags`) already exist and are reused as-is (see steps 02/03) — no new shared helper needed for those two.
