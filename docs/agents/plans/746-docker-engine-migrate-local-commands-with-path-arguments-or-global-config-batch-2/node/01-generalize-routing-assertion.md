# Generalize the docker routing assertion

`expectRepoMountOnlyRun` and `itRoutesWithInvocationLog` hard-code batch 1's shape: only the repo mount, only the fixed env names. Batch 2 needs the same check with expected extra mounts and env. Add an `expectRunWith(calls, repoPath, after, { mounts, envNames })`-style assertion, and let `expectRepoMountOnlyRun` delegate to it with no extras. Let `itRoutesWithInvocationLog` take optional `dockerMounts(ctx)` / `dockerEnvNames`, defaulting to none, so batch-1 specs stay unchanged. Note: `itRoutesWithInvocationLog` points `CLAUDE_CONFIG_DIR` at an empty dir, so a `global-config` case must seed `arcanum-config.json` there to see the `:ro` mount.

## Files to Change

- `core/spec/support/factories/engineDispatchDockerSetup.js`: new assertion with extra mounts/env; `expectRepoMountOnlyRun` delegates to it.
- `core/spec/support/sharedExamples/invocationLogRouting.js`: optional expected docker mounts/env.
