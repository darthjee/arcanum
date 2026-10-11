# Add docker routing callbacks for the batch-4 shims

Give each batch-4 shim's shim-level routing spec a `docker` callback that asserts the mounts and env for its `--needs` value. For `remote`, this means the ssh-origin wiring (agent socket mount, `known_hosts:ro` mount, `-e SSH_AUTH_SOCK`, `-e GIT_SSH_COMMAND`) and, for an https origin, the gh credential-helper `GIT_CONFIG_COUNT` env. For `gh`, it means `GH_TOKEN` by name only. Reuse the ssh-origin pattern from the #747 resolve-and-fetch routing case (a fake `ssh` on `PATH` keeps git offline). Add a routing spec for any batch-4 shim that has none.

## Files to Change

- `core/spec/bin/*EngineDispatch_spec.js` for the batch-4 shims (e.g. `autoFixAllEngineDispatch_spec.js`, `arcanumSplitIssueEngineDispatch_spec.js`, `sharedLibEngineDispatch_spec.js`, plus new ones for auto-fix-issue, auto-monitor-pr, auto-new-issue and auto-plan-issue if missing)
- `core/spec/support/factories/engineDispatchDockerSetup.js`: shared helpers, if needed
