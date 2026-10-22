# Infra Plan: Review dev-only files shipped in the release zip and runtime image

Main plan: [plan.md](plan.md)

## Shared contracts

- Append the 13 entries from the main plan's table to `EXCLUDES`, right after `"shared/spec/"` and before `"arcanum.version"`, in the table's order.
- Glob rule: an entry containing `*` is matched with unquoted bash pattern matching; all other entries keep today's behavior.
- Mirror every entry in the root `.dockerignore`'s "Mirrors scripts/build_release_zip.sh EXCLUDES." block, same order.
- `core/Dockerfile`, `.dockerignore`, `core/docker-entrypoint.sh`, `core/docker-runtime-*.sh`, `core/package.json`, `core/yarn.lock` must keep shipping.

## Implementation Steps

### Step 1 — `EXCLUDES` and glob matching in `scripts/build_release_zip.sh`

- Add the entries to `EXCLUDES`.
- In `is_excluded`, add a branch before the trailing-`/` one: when `$exclude` contains `*` (`[[ "$exclude" == *"*"* ]]`), return 0 if `[[ "$path" == $exclude ]]` (right side unquoted, so it globs). Add a short comment saying why it's unquoted.
- Extend the header comment: CI, lint and test tooling config (`.circleci/`, lint configs, the `Makefile`, `core/docker-compose.yml`, the mod's tests and `tsconfig.json`) and `arcanum.png` are dev-only and never shipped; mention the glob form.

### Step 2 — Mirror in `.dockerignore`

Add the same entries, same order, to the mirror block, below `shared/spec/` and above `arcanum.version`. `.dockerignore` (Go `filepath.Match`) supports `arcanum-next-step/hooks/*.test.ts` as-is.

## Files to Change

- `scripts/build_release_zip.sh` — new `EXCLUDES` entries, glob branch in `is_excluded`, header comment.
- `.dockerignore` — mirrored entries.

## CI Checks

- `scripts/build_release_zip.sh --list | grep -E '^(\.circleci/|\.codacy\.yml|\.markdownlint|Makefile$|arcanum\.png|core/(eslint\.config\.mjs|\.jscpd\.json|docker-compose\.yml)|arcanum-next-step/(tsconfig\.json|hooks/.*test.*\.ts))'` prints nothing.
- `scripts/build_release_zip.sh --list | grep -E '^(core/Dockerfile|\.dockerignore|core/docker-entrypoint\.sh)$'` prints all three.
- `make core-smoke-runtime` (builds the runtime image from the filtered context and smoke-tests it). Run it before the `Makefile` exclusion matters: it uses the dev checkout's `Makefile`, which still exists in git.

## Notes

- The `Makefile` is excluded from the zip and image only; it stays in git and in dev checkouts.
- Don't touch `core/Dockerfile`: the test stage stays where it is.
