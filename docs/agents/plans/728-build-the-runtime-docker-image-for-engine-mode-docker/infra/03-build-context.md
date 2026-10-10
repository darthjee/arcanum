# Build context: .dockerignore and compose

The `runtime` target is built with the **install root** as context and `-f core/Dockerfile`. That context must yield the release-zip file set whether it is a dev checkout or a zip install.

- Add a root `.dockerignore` mirroring `scripts/build_release_zip.sh`'s `EXCLUDES`, plus local/dev junk: `.git`, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/` with `!docs/guides/`, `.github/`, `ISSUE_TEMPLATE.md`, `.gitignore`, `scripts/`, `arcanum.version`, `arcanum.json` (the image writes its own), `core/node_modules/`, `core/coverage/`, `synced/`, `dist/`. Add a header comment saying it must stay in sync with `build_release_zip.sh`'s `EXCLUDES`.
- Update `core/docker-compose.yml` so the `test` service builds from the new context: `build: { context: .., dockerfile: core/Dockerfile, target: test }`. Volumes, `working_dir` and `command` stay the same.
- Confirm `make core-test`, `core-lint`, `core-shell` still work (the test stage must not need anything `.dockerignore` excludes; it only `COPY`s `core/docker-entrypoint.sh`).

## Files to Change
- `.dockerignore` — new; install-root context filter matching the release zip.
- `core/docker-compose.yml` — build context `..`, `dockerfile: core/Dockerfile`, `target: test`.
