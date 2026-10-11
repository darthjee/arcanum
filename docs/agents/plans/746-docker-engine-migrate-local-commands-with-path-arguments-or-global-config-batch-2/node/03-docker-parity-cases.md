# Docker parity cases

Add parity cases under `core/spec/docker/` with `describeParityRepos` / `itMatchesNativeInDocker`, running each shim's real `engine_dispatch` call (with the new flags) natively and in `PARITY_IMAGE`. Compare stdout, stderr, exit code and file changes, including files written outside the repo (host-owned on Linux). Per command:

- `create-sub-issue-file`: body file outside the repo (`ro`), plus a usage-error case.
- `render-issue`: output file in a dir outside the repo (`rw`, the file does not exist yet), plus one inside the repo.
- `write-label-config` add/remove/replace: config file outside the repo.
- `stamp-arcanum-version`: same stamped version in the repo/local config pointers as native, with a seeded global config. Run it against the parity image built with an `ARCANUM_VERSION`. Report whether a `local-<sha>` dev build differs.

One command per family also runs from a git worktree (`{ worktree: true }`). If `itMatchesNativeInDocker` only diffs the repo, extend `dockerParitySetup.js` to also diff a given out-of-repo dir.

## Files to Change

- `core/spec/docker/arcanumSplitIssue_spec.js` (new).
- `core/spec/docker/discussIssue_spec.js`: render-issue cases.
- `core/spec/docker/initClaude_spec.js`: stamp and write-label-config cases.
- `core/spec/support/factories/dockerParitySetup.js`: out-of-repo file-change diff, if needed.
