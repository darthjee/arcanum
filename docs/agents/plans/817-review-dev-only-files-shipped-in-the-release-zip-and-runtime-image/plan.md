# Plan: Review dev-only files shipped in the release zip and runtime image

Issue: [817-review-dev-only-files-shipped-in-the-release-zip-and-runtime-image.md](../../issues/817-review-dev-only-files-shipped-in-the-release-zip-and-runtime-image.md)

## Overview

Stop shipping the remaining dev-only files (CI and lint config, the root `Makefile`, `core/` dev tooling, the mod's tests and type-check config, `arcanum.png`) in the release zip and the runtime image. `infra` adds them to `EXCLUDES` in `scripts/build_release_zip.sh`, teaching `is_excluded` a glob form for the mod's `*.test.ts` files, and mirrors them in the root `.dockerignore`. `node` extends the `--list` packaging spec to guard both the excluded and the kept paths. `architect` updates the architecture docs.

## Agents involved

- [infra](infra.md)
- [node](node.md)
- [architect](architect.md)

## Shared contracts

### Excluded paths (exact entries, in this order, appended to `EXCLUDES` after `"shared/spec/"`, and mirrored in the `.dockerignore` "Mirrors scripts/build_release_zip.sh EXCLUDES." block)

| `EXCLUDES` entry | Match kind | `.dockerignore` line |
|------------------|------------|----------------------|
| `.circleci/` | prefix | `.circleci/` |
| `.codacy.yml` | exact | `.codacy.yml` |
| `.markdownlint.json` | exact | `.markdownlint.json` |
| `.markdownlintignore` | exact | `.markdownlintignore` |
| `Makefile` | exact | `Makefile` |
| `arcanum.png` | exact | `arcanum.png` |
| `core/eslint.config.mjs` | exact | `core/eslint.config.mjs` |
| `core/.jscpd.json` | exact | `core/.jscpd.json` |
| `core/docker-compose.yml` | exact | `core/docker-compose.yml` |
| `shared/eslint.config.mjs` | exact | `shared/eslint.config.mjs` |
| `arcanum-next-step/tsconfig.json` | exact | `arcanum-next-step/tsconfig.json` |
| `arcanum-next-step/hooks/test-support.ts` | exact | `arcanum-next-step/hooks/test-support.ts` |
| `arcanum-next-step/hooks/*.test.ts` | glob (new) | `arcanum-next-step/hooks/*.test.ts` |

### Glob match rule

An `EXCLUDES` entry containing `*` is a glob: `is_excluded` matches it with bash pattern matching (`[[ "$path" == $exclude ]]`, unquoted right side). Entries without `*` keep today's behavior (trailing `/` = prefix, otherwise exact; `docs/` keeps its carve-out).

### Paths that must keep shipping (asserted by the spec)

`core/Dockerfile`, `.dockerignore`, `core/docker-entrypoint.sh`, `core/docker-runtime-entrypoint.sh`, `core/docker-runtime-env.sh`, `core/package.json`, `core/yarn.lock`, `core/bin/arcanum`, `README.md`, `arcanum-next-step/hooks/register.ts`.

`core/docker-entrypoint.sh` stays: the `test` stage of `core/Dockerfile` `COPY`s it, and the legacy (non-BuildKit) builder builds that stage even with `--target runtime`.

### No runtime change

No installer, updater, engine or mod runtime code changes. Existing zip installs drop the excluded files on their next update, through the updater's `MANIFEST` diff.
