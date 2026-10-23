# Plan: Generic arcanum config commands

Issue: [780-generic-arcanum-config-commands.md](../../issues/780-generic-arcanum-config-commands.md)

## Overview
Implement `arcanum config get/set/unset/list/info` in `cli/`, following `docs/agents/specs/arcanum-cli/command-surface.md` and the index spec's Targeting, `arcanum config info` and Version skew sections. Only `cli/` changes: the CLI uses the `shared/` config and file services, including #825's `unset`, `timeoutMs` and top-level `write`, without modifying them. The work is staged: arguments, targeting and errors first, then the reads, then the writes, then the docs.

See [client.md](client.md) for the full plan.
