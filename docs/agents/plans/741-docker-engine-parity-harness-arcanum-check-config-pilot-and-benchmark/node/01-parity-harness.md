# Parity harness

Set up the local-only parity suite described in `docs/agents/specs/docker/testing.md` ("Parity specs (local only)").

- Add `core/spec/support/jasmine-docker.json`, mirroring `jasmine.json`'s `env` block, with `spec_files: ["docker/**/*_spec.js"]`. Check that `jasmine.json`'s globs (`lib/**`, `bin/**`) don't match `spec/docker/`.
- Add the `test:docker` script to `core/package.json`.
- Add a support helper, e.g. `core/spec/support/utils/dockerParity.js`, exporting:
  - `PARITY_IMAGE`: from `ARCANUM_DOCKER_PARITY_IMAGE`, default `darthjee/arcanum:local-test`;
  - a function that runs `engine_dispatch` twice for the same args, once with `engine.mode=native` and once with `engine.mode=docker`. Both runs go through `runEngineDispatch` with a temp status map that marks the command `"docker"`, and the docker run also passes `{ image: PARITY_IMAGE }`. Reuse `writeStatusMap` and `seedEngineMode`. The function returns both results. The docker run must not print the `Docker is unavailable` warning; if it does, the spec fails with a clear message, so a missing image or daemon never passes as parity;
  - a file-tree snapshot/diff helper. It compares the files created or changed in the repo, and in any argument dirs, after each run (content, and owner uid on Linux);
  - `itWithGh(...)` and `itWithSsh(...)` wrappers that call `pending()` unless `ARCANUM_DOCKER_PARITY_GH=1` or `ARCANUM_DOCKER_PARITY_SSH=1` is set.
- Reuse the existing fixtures (`gitFixtureRepo.js`, including its worktree variant, `tempDir.js`, and the per-command parity setups under `core/spec/support/factories/`) rather than new ones.
- Before any case runs, a `beforeAll` checks that `docker image inspect <PARITY_IMAGE>` succeeds. If it doesn't, fail with a message pointing at `make docker-parity`.

## Files to Change

- `core/spec/support/jasmine-docker.json` (new): the parity config.
- `core/package.json`: the `test:docker` script.
- `core/spec/support/utils/dockerParity.js` (new): parity helpers.
