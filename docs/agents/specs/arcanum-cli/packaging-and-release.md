# Arcanum CLI: Packaging and Release

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define where the CLI code lives, how it is packaged as the `arcanum-cli` npm package, and how it is released.

## Decisions

### Code layout

The code lives in a new root-level folder, **`cli/`**, owned by the `client` agent (see [Ownership](../arcanum-cli.md#ownership)):

| Path | Contents |
| --- | --- |
| `cli/bin/arcanum` | the npm `bin` entry |
| `cli/lib/` | CLI source |
| `cli/spec/` | Jasmine specs mirroring `cli/lib/` one to one, with c8 coverage |
| `cli/package.json` | package manifest |
| `cli/eslint.config.mjs` | lint config, same style rules as `core/` |
| `cli/README.md` | developer README, also the npm package page |

The stack mirrors `core/`: Node.js ESM, Yarn, Jasmine, c8, ESLint.

### `cli/package.json`

- `name: "arcanum-cli"`;
- `bin: {"arcanum": ...}`, so the installed command is `arcanum`;
- a `files` whitelist;
- `engines.node`;
- zero runtime `dependencies`;
- devDependencies for Jasmine, c8, ESLint and `esbuild`.

### Build output

The build produces one bundled file containing the CLI, the shared config surface and the key registry. See [Shared Config Logic](shared-config-logic.md).

### Install

- `npm i -g arcanum-cli`. npm handles PATH, updates and uninstall, so there is no custom installer.
- The CLI is optional. No per-repo migration installs it or nudges the user to.

### Release

- The package is published from the existing CircleCI release pipeline (see [Install and Release](../../architecture/install-and-release.md)), on the same semver tag as arcanum. The CLI version moves in lockstep with arcanum's version.
- The publish job and the npm token setup are owned by `infra`, whose scope gains `.circleci/`.
- The npm token is a CircleCI secret and is never printed.

### Local tooling

Docker, docker-compose and Makefile `cli-*` targets for running the CLI specs are owned by `infra`.

## Alternatives considered

- **A release-zip tarball with its own `curl | bash` bootstrap.** Rejected: arcanum would have to own PATH handling, updates and uninstall, which npm already does.
- **A standalone binary via `bun build --compile` or `pkg`.** Rejected: it needs per-OS builds and heavier CI.
- **Shipping the CLI inside each arcanum install, plus a PATH migration.** Rejected: users with several installs would get several competing clients.

## Open points

- npm provenance: whether to publish with `--provenance`, and what CircleCI needs for it.
- Failure handling when the npm publish fails after the GitHub release has succeeded.
- The minimum Node.js version in `engines.node`.
- Whether pre-release tags publish under an npm dist-tag (e.g. `next`) instead of `latest`.
