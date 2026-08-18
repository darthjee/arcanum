# Plan: Implement the shell/native/docker dispatch guard and migration-status map

Issue: [192-implement-the-shell-native-docker-dispatch-guard-and-migration-status-map.md](../../issues/192-implement-the-shell-native-docker-dispatch-guard-and-migration-status-map.md)

## Overview

Build the shared dispatch guard (`arcanum/_lib/engine_dispatch.sh`) that resolves `engine.mode` via the existing 3-tier config chain, consults a new `arcanum/_lib/migration-status.json` map, and dispatches each call to either the existing shell path or the centralized native entrypoint `core/bin/arcanum <command> <args...>`. `core/bin/arcanum`'s current stub also gets real command routing to `core/lib/` modules. Both sides are proven together against one throwaway fixture command — no real entrypoint is wired in yet.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: a single lowercase-kebab identifier per entrypoint, used identically as (a) the `<command>` argument `engine_dispatch.sh` passes to `core/bin/arcanum <command> <args...>`, (b) the key in `arcanum/_lib/migration-status.json` (`{"<command>": true|false}`), and (c) the routing key `core/bin/arcanum` uses to pick the matching `core/lib/` module. For this issue's proof, the fixture command is named `dispatch-fixture`.
- **Invocation contract**: when dispatching to native, `engine_dispatch.sh` invokes `core/bin/arcanum <command> <args...>` as a plain argv call (bash already avoids string-interpolated `exec`-style invocation here — no shell metacharacter risk), after setting an explicit, per-command environment-variable allowlist rather than passing through the full inherited environment.
- **Output/exit-code contract**: for the `dispatch-fixture` command, the native module invoked through `core/bin/arcanum` must produce byte-identical stdout and the same exit code as the shell-side fixture, for the same inputs, across all three cases (plain success, an "unavailable" case, and a "crash" case). scripter owns the shell-side fixture script and its expected outputs; node owns the native-side fixture module producing the matching output; the parity assertions live in scripter's `test_engine_dispatch.sh` (invoking both sides and diffing).
- **Migration-status map**: `arcanum/_lib/migration-status.json`, owned/written by scripter. node does not read this file directly (only `engine_dispatch.sh` consults it) but must know the `dispatch-fixture` key exists and is `true` once its native fixture module lands, so scripter can set it in the map.
