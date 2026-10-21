# arcanum-cli

`arcanum-cli` is the command-line client for [Arcanum](https://github.com/darthjee/arcanum), a collection of Claude Code skills. It installs an `arcanum` command that reads and writes Arcanum's configuration tiers (global, repo and local) through the same shared config logic the skills use, so it sees and writes exactly what they do.

> This is an early scaffold. Only `arcanum --help`, `arcanum --version` and `arcanum config --help` work yet; the `config get/set/unset/list/info` subcommands are coming next.

## Install

```bash
npm i -g arcanum-cli
arcanum --version
```

It needs Node.js 22.13.0 or newer and has no runtime dependencies. For a one-off look without a global install, use `npx arcanum-cli --help`.

This package is not the internal `core/bin/arcanum` dispatcher that Arcanum's skills call. That one ships inside Arcanum installs and is not meant to be run by hand.

## Development

Run from `cli/`, with the whole repository checked out (the build reads `../core/` and `../arcanum/migrations/`):

```bash
yarn install
yarn lint
yarn build   # writes dist/arcanum.mjs
yarn test    # needs yarn build first, for the smoke specs
```

From the repository root, the Docker-based `make cli-install`, `make cli-lint`, `make cli-build`, `make cli-test`, `make cli-check`, `make cli-shell` and `make cli-audit` targets do the same.

## Design

Until the user guide is written, see the [Arcanum CLI spec](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/arcanum-cli.md) and its parts under `docs/agents/specs/arcanum-cli/`.
