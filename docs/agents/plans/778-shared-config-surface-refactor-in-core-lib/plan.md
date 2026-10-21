# Plan: Shared config surface refactor in core/lib

Issue: [778-shared-config-surface-refactor-in-core-lib.md](../../issues/778-shared-config-surface-refactor-in-core-lib.md)

## Overview
Prepare `core/lib`'s config logic to be bundled into `arcanum-cli`, per `docs/agents/specs/arcanum-cli/shared-config-logic.md`: declare and lint-enforce the shared surface, introduce `ConfigError`, add `ConfigChain#readWithSource`, a shared `AgentEmail` helper and `RepoPath#toplevel`. All work is in `core/`, owned by `node`.

See [node.md](node.md) for the full plan.
