# Parity and engine-dispatch specs

Update the shell-vs-native parity spec to the new outputs:
- The config-off case now pushes (assert the remote ref moved) and ends on the safe branch (assert HEAD detached at `origin/main`).
- Add a dirty-tree case expecting `RELEASED=false` while staying on `issue-<id>`.
- Mark-ready needs `gh`. Stub it in both worlds (e.g. a fake `gh` first on `PATH` that exits 0 or 1), so `READY=` is deterministic and no network is used.

Update the engine-dispatch spec if it asserts the env allowlist (the new `GH_TOKEN`/`GH_HOST`/`GH_ENTERPRISE_TOKEN` entries).

## Files to Change
- `core/spec/bin/autoPlanIssueAutoNextParity_spec.js` — new expectations, dirty-tree case, `gh` stub.
- `core/spec/bin/autoPlanIssueAutoNextEngineDispatch_spec.js` — allowlist expectations, if any.
