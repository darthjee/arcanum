# Plan: Investigate removing dispatch-fixture / dispatch-fixture-crash

Issue: [340-investigate-removing-dispatch-fixture---dispatch-fixture-crash.md](../issues/340-investigate-removing-dispatch-fixture---dispatch-fixture-crash.md)

## Overview

Retire the `dispatch-fixture` success-path command (and `DispatchFixture.js#run()`) by re-anchoring the shell/native dispatch parity proof it currently backs onto a real, already-migrated `context: 'none'` command — `auto-fix-all-config-get` — following the existing real-command parity-test pattern already used for the `auto-fix-all-config-*` family (`core/spec/bin/autoFixAllConfigParity_spec.js`). `dispatch-fixture-crash` and `DispatchFixture.js#crash()` are explicitly out of scope and stay unchanged (tracked separately in #342), as is the future of the `log: false` feature itself (#343).

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

Both agents anchor their respective proofs on the same real command, so the routing/output contract they rely on must match exactly:

- **Command**: `auto-fix-all-config-get` (native: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js#get`; shell twin: `auto-fix-all/scripts/config_get_shell.sh`). Already `context: 'none'` in `core/lib/core/commands.js` — no dispatcher changes needed to use it as the anchor.
- **Calling convention**: `<script-or-native> <repo_path> <key>`. `<repo_path>` must be a real git repository (the shell side's `repo_path_enter`, via `arcanum/_lib/repo_path.sh`, requires it — the native side does not, but the fixture repo is shared between both invocations).
- **Fixture seeding**: `<repo_path>/.claude/configuration/arcanum-repo-config.json` containing `{"auto-fix-all": {"<key>": true}}` for a present-key case.
- **Expected output**: byte-identical `stdout` = `"true\n"`, exit code `0`, for both the shell twin and the native command given the same seeded fixture and key.

- `scripter` owns rewiring `arcanum/_lib/test_engine_dispatch.sh`'s shell/native parity cases onto this contract (it already knows how to seed/git-init a fixture repo for other `engine_dispatch` cases).
- `node` owns rewiring `core/spec/lib/core/dispatcher_spec.js`'s `context: 'none'` unit-level proof onto the same command name, so both proofs stay pointed at the same real command rather than drifting apart.
