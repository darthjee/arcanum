# Issue: Review dev-only files shipped in the release zip and runtime image

## Description

Stop shipping development-only files in the release zip and the runtime Docker image.

This came out of the refinement of #816. #821 already stopped shipping the spec folders (`core/spec/`, `shared/spec/`). This issue covers every other dev-only file.

## Problem

`scripts/build_release_zip.sh` packages every git-tracked file except the `EXCLUDES` list, and the root `.dockerignore` mirrors that list for the runtime image (`COPY . $ARCANUM_ROOT`). Today `scripts/build_release_zip.sh --list` still includes files used only for linting, CI and tests:

- CI and lint config: `.circleci/config.yml`, `.codacy.yml`, `.markdownlint.json`, `.markdownlintignore`;
- `core/` dev tooling: `core/eslint.config.mjs`, `core/.jscpd.json`, `core/docker-compose.yml`;
- the root `Makefile`, which drives only dev and CI targets;
- the mod's tests and type-check config: `arcanum-next-step/hooks/*.test.ts`, `arcanum-next-step/hooks/test-support.ts`, `arcanum-next-step/tsconfig.json`;
- `arcanum.png`, which the README loads from a remote URL, not from the install.

## Expected Behavior

Inventory of the paths that ship today, with the decision for each:

| Path | Decision | Why |
|------|----------|-----|
| `.circleci/` | exclude | CI only |
| `.codacy.yml`, `.markdownlint.json`, `.markdownlintignore` | exclude | lint/analysis config |
| `Makefile` | exclude | dev/CI targets only; installer, updater and engines never call `make` |
| `core/eslint.config.mjs`, `core/.jscpd.json` | exclude | lint/duplication config |
| `core/docker-compose.yml` | exclude | dev compose setup |
| `arcanum-next-step/hooks/*.test.ts`, `arcanum-next-step/hooks/test-support.ts`, `arcanum-next-step/tsconfig.json` | exclude | mod tests and type-check config |
| `arcanum.png` | exclude | README loads the image from a remote URL |
| `shared/eslint.config.mjs` (once `shared/` exists, #822) | exclude | lint config |
| `core/Dockerfile`, `.dockerignore` | keep | docker engine local-build fallback (`docker build -f core/Dockerfile --target runtime` from the install root) |
| `core/docker-entrypoint.sh` | keep | the Dockerfile's `test` stage `COPY`s it; the legacy (non-BuildKit) builder builds stages before `runtime` even with `--target runtime` |
| `core/docker-runtime-entrypoint.sh`, `core/docker-runtime-env.sh` | keep | runtime image |
| `core/package.json`, `core/yarn.lock`, `core/bin/`, `core/lib/` | keep | native engine and `yarn install --production` |
| `README.md`, `docs/guides/` | keep | end-user docs |
| skill folders, `arcanum/`, mod runtime files (`.claude-plugin/`, `hooks/hooks.json`, `hooks/register.ts`, `types/`, `README.md`) | keep | runtime |

- The excluded paths are added to `EXCLUDES` and the root `.dockerignore`, and the two lists stay in sync.
- `core/spec/release/buildReleaseZipList_spec.js` gets a case asserting that none of the excluded paths appears in `--list`, and that the kept Docker files still do.

## Solution

- `EXCLUDES` only supports exact paths and trailing-`/` prefixes. The `*.test.ts` files need a suffix/glob match: extend `is_excluded` with a glob form (for example `arcanum-next-step/hooks/*.test.ts`), and use the matching pattern in `.dockerignore`.
- The `c8` blocks in `core/package.json` stay: they can't be dropped without editing the file, and `package.json` must ship.
- Existing installs drop the excluded files on their next update, through the updater's `MANIFEST` diff. No migration is needed.
- Docs: update the shipped-files description in `docs/agents/architecture/install-and-release.md` (and `docker-engine.md` if it lists the image contents).

### Owners

- `infra`: `scripts/build_release_zip.sh` and `.dockerignore`.
- `node`: the case in `core/spec/release/buildReleaseZipList_spec.js`.
- `architect`: the architecture docs.

### Dependencies

Independent of epic #816. Builds on #821, which is merged.

## Benefits

- Smaller installs and images, with no CI, lint or test files in them.
- Clear runtime vs. dev boundary, guarded by a spec.
