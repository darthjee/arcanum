# Docker routing callbacks for the batch-3 shims

Give every batch-3 command a `docker` callback in its shim-level routing spec, through the real shim, with a passthrough fake `docker`. Extend `itRoutesWithInvocationLog` / `itRoutesEngineDispatch` or the batch-2 `expectRunWith`-style helper, if needed, to assert the gh env name (`GH_TOKEN`), the gitconfig mount and `GIT_CONFIG_GLOBAL`, and that no token value appears in argv. Seed `arcanum-config.json` in the case's `CLAUDE_CONFIG_DIR` and point `GIT_CONFIG_GLOBAL` at a temp gitconfig so both `:ro` mounts appear. For the 5 path-arg commands, cover a file inside the repo (no extra mount) and one outside it (`:ro` file mount). Add one GitHub Enterprise case (a non-github.com origin) on a single command, asserting `GH_HOST` + `GH_ENTERPRISE_TOKEN` instead of `GH_TOKEN`, unless `engineDispatchDocker_spec.js` already covers it.

Several shims have no routing spec yet (`resolve_and_fetch.sh`, `spawn_issue.sh`, `create_sub_issue.sh`, `push_sub_issues.sh`, `resolve_pr_number.sh`, `monitor-issues/scripts/github.sh`). Add shell/native/docker routing for them next to the existing ones.

## Files to Change

- `core/spec/bin/githubIssueMarkParity/engine_dispatch_spec.js` (or a new `githubIssueEngineDispatch_spec.js`): `github_issue.sh`, all 10 subcommands.
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`: pr-number/state/merge, has-label, has-shipit-label, add/remove-tag.
- `core/spec/bin/autoFixAllEngineDispatch_spec.js`: queue `save`/`push` with gh needs. Batch-1 queue subcommands stay repo-mount-only.
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js`, `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`.
- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`: pr-create/view/ready.
- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js`: sync_labels.
- `core/spec/bin/monitorIssuesEngineDispatch_spec.js`: monitor_issues.sh and github.sh remove-tag.
- `core/spec/bin/sharedLibEngineDispatch_spec.js`: resolve_and_fetch.sh, spawn_issue.sh.
- `core/spec/bin/arcanumSplitIssueEngineDispatch_spec.js`: create_sub_issue.sh, push_sub_issues.sh.
- `core/spec/bin/autoMonitorIssuePrEngineDispatch_spec.js` (new): resolve_pr_number.sh.
- `core/spec/support/factories/engineDispatchDockerSetup.js`, `core/spec/support/sharedExamples/invocationLogRouting.js`: gh env and gitconfig assertions, if needed.
