# Plan: Infra: extract Dispatcher, commands.js and takesRepoContext flag

Issue: [309-infra-extract-dispatcher-commands-js-and-takesrepocontext-flag.md](../../issues/309-infra-extract-dispatcher-commands-js-and-takesrepocontext-flag.md)

## Overview

Split `core/bin/arcanum`'s `dispatch()` into a `Dispatcher` class
(`core/lib/core/dispatcher.js`) and an extracted `COMMANDS` registry
(`core/lib/core/commands.js`), and introduce the `takesRepoContext` flag
mechanism that later #308 sub-issues use to migrate commands to
construction-time `RepoContext`. No real command is migrated; the flag defaults
off; `InvocationLog` recording moves into `Dispatcher`; the entrypoint becomes a
thin argv-parse-and-print shell that keeps the exact output/exit-code contract.

All work is in the `node` agent's scope (`core/lib/`, `core/bin/`, `core/spec/`).

See [node.md](node.md) for the full plan.
