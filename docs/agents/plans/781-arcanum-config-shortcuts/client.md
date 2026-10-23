# Client Plan: arcanum config shortcuts

Main plan: [plan.md](plan.md)

## Overview
Wire the shortcut namespaces into `arcanum config` and implement each one by delegating to the #780 generic `get`/`set`/`unset` code paths, so that output, JSON and exit codes are byte-identical to theirs. The spec is the contract. Each step names the sections it implements.

## Context
- **Hard prerequisites:** #780 (the generic layer, with its argument, targeting, tier-reading, validation, skew, lock and output modules) and #841 (`RepoConfigWriter#update`) must both be merged. Build on the module names #780 actually landed with. Don't create parallel copies of its parsing, targeting or output logic. If a #780 helper isn't reusable as it stands, refactor it in place.
- Shared services, used as they are: `AgentEmail#resolve(repoPath, agent)` → `{ email, raw, tier, key } | undefined`, `ConfigChain#readWithSource`, `KeyRegistry` (`lookup`/`check`, including the `default` field and `tiers`), and `RepoConfigWriter#update` (#841). Any other gap in `shared/` becomes a separate `shared` issue.
- Registry facts the shortcuts rely on: `auto-fix-all.ignored_check_patterns` is `tiers: ["repo"]`, `type: "array"`, `format: "regex"`. `git.safe_branch` is local-only.

## Steps

- [01 — Shortcut dispatch and single-value shortcuts](client/01-single-value-shortcuts.md)
- [02 — next-step auto](client/02-next-step-auto.md)
- [03 — agents email](client/03-agents-email.md)
- [04 — ignore-checks](client/04-ignore-checks.md)
- [05 — Help and docs](client/05-docs.md)

## CI Checks
- `cli`: `cd cli && yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- The spec's main test is byte-identity with the generic command. Write those specs by running both argvs through `main.js#run` with the same fake IO and comparing stdout, stderr and the exit code. Don't hand-copy the expected strings.
- Shortcuts refuse `--force` and `--string` (usage, exit `2`, through strict per-shortcut option sets). The `--repo` path/tier overload from #780 applies unchanged.
- An agent literally named `set`/`unset` is only reachable through the generic commands. That's accepted, so don't add special handling.
