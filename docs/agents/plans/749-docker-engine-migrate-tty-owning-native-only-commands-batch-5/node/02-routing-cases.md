# Docker routing cases

`core/spec/bin/arcanumCreateIssue_spec.js` currently has the case "runs both shims native on the host with the not-docker-ready warning when engine.mode is docker". Replace it with docker routing cases for both shims through the real `start.sh` / `publish.sh` and the fake docker bin, using the gh-needs shared example (`itRoutesGhEngineDispatch` in `core/spec/support/sharedExamples/ghEngineDispatchRouting.js`) if it fits a native-only shim. Otherwise, follow the batch-3 docker cases in `core/spec/bin/githubIssueEngineDispatch_spec.js`.

Assert the exact `docker run` argv:
- global-config and gitconfig `:ro` mounts;
- `GH_TOKEN` passed by name;
- no `-t`;
- the forwarded args.

Keep the existing shell/native (unset / `shell` / `native` mode) cases.

## Files to Change

- `core/spec/bin/arcanumCreateIssue_spec.js` — replace the not-docker-ready case with docker routing cases for both shims.
- `core/spec/support/sharedExamples/ghEngineDispatchRouting.js` — only if a small extension is needed for `--native-only` (empty shell script).
