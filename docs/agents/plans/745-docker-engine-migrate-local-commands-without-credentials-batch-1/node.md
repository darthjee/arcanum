# Node Plan: Docker engine: migrate local commands without credentials (batch 1)

Main plan: [plan.md](plan.md)

## Shared contracts

- The 29 keys in [plan.md](plan.md#shared-contracts) are `"docker"` in the real `arcanum/_lib/migration-status.json` (scripter step 01).
- Shim `engine_dispatch` calls are unchanged. Copy each one verbatim into the parity specs' `dispatchArgs`.
- Every batch-1 `docker run` has exactly the repo mount (plus the git common dir for a worktree) and no extra `-e` names.

## Steps

- [01 — Docker callbacks in the shim routing specs](node/01-routing-docker-callbacks.md)
- [02 — Native-only spec for init-claude-set-next-step-auto](node/02-set-next-step-auto-spec.md)
- [03 — Docker parity cases](node/03-docker-parity-cases.md)
- [04 — Fix specs that relied on the old status](node/04-fix-status-dependent-specs.md)

## CI Checks

- `core/`: `make core-test` (CircleCI `test` job: `yarn test`) and `yarn lint` (eslint, `core/eslint.config.mjs`).
- Parity: `make docker-parity` (local only). Report it as passing in the PR description, with the platform.

## Notes

- Follow the pilot (`3f31ff2`): `core/spec/bin/arcanumCheckConfig_spec.js` for docker-mode routing assertions (`runCalls`, `splitRunArgv`, `fixedRunFlags`), and `core/spec/docker/arcanumCheckConfig_spec.js` for parity (`runDockerParity`, `expectDockerParity`, `withoutPlatformNotice`, `requireParityImage`, realpath'd temp dirs).
- Factor out a shared helper for the repeated "repo mount only, no extra env" docker assertion (e.g. in `core/spec/support/factories/engineDispatchDockerSetup.js`) so 28 callbacks don't repeat it.
- Parity cases run one `docker run` per call, so keep each command's case list small (one success, one error path where cheap) and give each the pilot's `TIMEOUT`.
