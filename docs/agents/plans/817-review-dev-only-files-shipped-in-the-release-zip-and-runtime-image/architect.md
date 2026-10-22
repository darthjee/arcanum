# Architect Plan: Review dev-only files shipped in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- The excluded and kept paths from the main plan; the glob rule.

## Implementation Steps

### Step 1 — `docs/agents/architecture/install-and-release.md`

After the spec-folders paragraph (line 10), add a paragraph: CI, lint and test tooling (`.circleci/`, `.codacy.yml`, the markdownlint files, the root `Makefile`, `core/eslint.config.mjs`, `core/.jscpd.json`, `core/docker-compose.yml`, `shared/eslint.config.mjs`, the mod's `hooks/*.test.ts`, `hooks/test-support.ts` and `tsconfig.json`) and `arcanum.png` are dev-only and listed in `EXCLUDES`. Mention that an entry containing `*` is a glob. Say what keeps shipping on purpose: `core/Dockerfile` and `.dockerignore` (docker engine local build), `core/docker-entrypoint.sh` (the `test` stage `COPY`s it, and the legacy builder builds it even with `--target runtime`), `package.json`/`yarn.lock`, `README.md`. Existing installs drop the excluded files through the `MANIFEST` diff. The packaging spec guards both sides.

### Step 2 — `docs/agents/architecture/docker-engine.md`

On line 55, extend the `.dockerignore` sentence: the mirror block also keeps the CI, lint and test tooling files out of the runtime image (link to the install-and-release paragraph instead of repeating the list).

## Files to Change

- `docs/agents/architecture/install-and-release.md` — new paragraph.
- `docs/agents/architecture/docker-engine.md` — line 55 extension.

## Notes

- Keep the wording short; link instead of duplicating the path list.
