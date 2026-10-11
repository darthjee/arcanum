# gh sandbox parity harness

`itWithGh` already gates on `ARCANUM_DOCKER_PARITY_GH=1`. Add a small helper on top of it that reads the sandbox env (`ARCANUM_DOCKER_PARITY_GH_REPO`, `ARCANUM_DOCKER_PARITY_GH_ISSUE`, `ARCANUM_DOCKER_PARITY_GH_PR`, and the PR head branch, by whatever var name you settle on). When a var the case needs is missing, mark the case pending with a message naming it. Make the fixture parity repo resolve to the sandbox: set its `origin` to the sandbox repo URL, so `origin.sh` and `gh` resolve the right host and repo in both runs. The token comes from the host (`GH_TOKEN`, `GITHUB_TOKEN` or `gh auth token`), never from a fixture file.

For label-mutation cases, add a helper that snapshots the fixture issue's labels before the native run, restores them between the native and docker runs (so both start from the same state, as `runDockerParity` restores the tree), and restores them in a `finally` at the end, whatever the outcome.

Document the new env vars in `docs/agents/specs/docker/testing.md`, under the Credentials bullet, and in the `docker-parity` comment in the root `Makefile` if useful.

## Files to Change

- `core/spec/support/utils/dockerParity.js`: sandbox env reader and gated `it` with per-var pending messages.
- `core/spec/support/factories/githubParitySetup.js` (or a new `dockerGhParitySetup.js`): sandbox origin wiring and the label snapshot/restore helper.
- `docs/agents/specs/docker/testing.md`: sandbox env vars.
- `Makefile`: comment only, if useful.
