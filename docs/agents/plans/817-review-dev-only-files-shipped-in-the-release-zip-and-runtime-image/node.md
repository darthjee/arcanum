# Node Plan: Review dev-only files shipped in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- After `infra`'s change, `scripts/build_release_zip.sh --list` prints none of the main plan's excluded paths, and still prints the "must keep shipping" paths.

## Implementation Steps

### Step 1 — Extend `core/spec/release/buildReleaseZipList_spec.js`

- Add `DEV_ONLY_FILES` (`.codacy.yml`, `.markdownlint.json`, `.markdownlintignore`, `Makefile`, `arcanum.png`, `core/eslint.config.mjs`, `core/.jscpd.json`, `core/docker-compose.yml`, `arcanum-next-step/tsconfig.json`, `arcanum-next-step/hooks/test-support.ts`) and a `forEach` case per file: `does not list <file>` (`expect(paths).not.toContain(file)`).
- Add `it('lists nothing under .circleci/')` with a `startsWith` filter, like the `cli/` case.
- Add `it('lists no mod *.test.ts file')`: `paths.filter((line) => /^arcanum-next-step\/hooks\/.*\.test\.ts$/.test(line))` equals `[]`.
- Add `RUNTIME_FILES` (`core/Dockerfile`, `.dockerignore`, `core/docker-entrypoint.sh`, `core/docker-runtime-entrypoint.sh`, `core/docker-runtime-env.sh`, `core/package.json`, `core/yarn.lock`, `core/bin/arcanum`, `README.md`) and a `forEach` case per file: `lists <file>`.
- `shared/eslint.config.mjs` isn't tracked yet, so it has no case.
- Extend the header comment to mention issue #817.

## Files to Change

- `core/spec/release/buildReleaseZipList_spec.js` — new cases and header comment.

## CI Checks

- `core`: `yarn test` and `yarn lint` inside `core/` (CI job: `test`), or `make core-test`.

## Notes

- The spec runs `--list` against the real checkout, so it depends on `infra`'s `EXCLUDES` change landing in the same PR.
