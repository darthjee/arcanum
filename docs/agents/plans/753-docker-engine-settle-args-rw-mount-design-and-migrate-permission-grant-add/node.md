# Node Plan: Docker engine: settle args:rw mount design and migrate permission-grant-add

Main plan: [plan.md](plan.md)

## Shared contracts

- **Rely on** scripter's `rw-mkdir` mode (semantics in [plan.md](plan.md#shared-contracts)), the `permission-grant-add` → `--path-arg=2:rw-mkdir` and `write-label-config-*` → `--path-arg=1:rw-mkdir` declarations, and `"permission-grant-add": "docker"` in `migration-status.json`.
- No `core/lib` change: `PermissionGrant.js` already does `mkdir -p`, `.tmp` + rename, and `.lock`.

## Implementation Steps

### Step 1 — Dispatch-level and routing specs (CI)

- `core/spec/bin/engineDispatchDocker_spec.js`, path-arg section (~lines 630–730):
  - Accept `rw-mkdir` in the valid-mode cases, and keep rejecting a bogus mode such as `1:rx`.
  - Add: `rw-mkdir` mounts the parent read-write, like `rw`.
  - Add: `rw-mkdir` with a missing parent creates it on the host and mounts it. Assert both the directory exists after the call and the `-v` is in the fake's argv log.
  - Add: `rw-mkdir` collapses with an `ro` file nested under it, the same as `rw`.
  - Keep "does not mount a missing rw parent" for plain `rw`.
- `core/spec/bin/sharedLibEngineDispatch_spec.js`: add an `itRoutesEngineDispatch` case for `arcanum/_lib/permission_grant.sh <anchor> add <file> <pattern>` with `shell`, `native` and `docker` callbacks. The `docker` callback asserts that the real shim reaches `docker run` (passthrough fake), that `.claude/settings.json` in the repo gets the pattern, and that there's no extra `-v` for a repo-relative target. Follow the existing cases in that file.
- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js`: if any docker callback there asserts the `--path-arg=1:rw` shape or missing-parent behavior, update it for `rw-mkdir`.

### Step 2 — Docker parity specs (local, `make docker-parity`)

- `core/spec/docker/sharedLib_spec.js`: add `describeParityRepos('permission-grant-add', …)` with `itMatchesNativeInDocker` cases, dispatching `--path-arg=2:rw-mkdir -- <repo> <file> <pattern>` (model them on `initClaude_spec.js`'s write-label-config cases):
  1. a repo-local target (`.claude/settings.json`, seeded and unseeded), compared with `nativeWrites`;
  2. an out-of-repo target in `outsideDir` (existing `settings.json`), compared with `nativeOutsideWrites`;
  3. an out-of-repo target whose parent directory does not exist yet: the file is created, matching native.
- `core/spec/docker/initClaude_spec.js` (write-label-config, ~line 159): switch the dispatch flags to `--path-arg=1:rw-mkdir`, and add a missing-parent case per subcommand where it makes sense (at least `replace`/`add`).
- Run `make docker-parity` locally and report it passing, with the platform, in the PR description (testing.md → Ticking a checklist row, item 2).

## Files to Change

- `core/spec/bin/engineDispatchDocker_spec.js` — `rw-mkdir` dispatch-level cases
- `core/spec/bin/sharedLibEngineDispatch_spec.js` — `permission_grant.sh` routing case with `docker` callback
- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js` — only if it asserts the old `rw` declaration
- `core/spec/docker/sharedLib_spec.js` — `permission-grant-add` parity cases
- `core/spec/docker/initClaude_spec.js` — `rw-mkdir` flags and a missing-parent case

## CI Checks

- `core`: `make core-test` (CircleCI `test` job, `yarn test`)
- `core`: `make core-lint` (CircleCI lint job, `yarn lint`)
- Local only: `make docker-parity`

## Notes

- `core/spec/bin/permissionGrantParity_spec.js` (shell vs native) stays as is.
