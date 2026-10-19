# Update the lock docs

- Rewrite `docs/agents/architecture/lock-system.md`:
  - the new mechanism (atomic create-if-absent, owner-checked release, id format, stale detection and the accepted re-read/remove residual race, Node-only `timeoutMs` / `LockTimeoutError` / `warn`);
  - properties (skills wait forever; a cross-host or unparseable lock still needs manual removal after the warning);
  - mixed-version behaviour (an old writer can still overwrite; fully exclusive once both sides are upgraded; no migration);
  - the current list of users (queue, config tiers, monitor-issues, issue state, permission grants, migrations, docker image lock), replacing "Currently used by `auto-fix-all/scripts/queue.sh`".
- `docs/agents/architecture/docker-engine.md` (around line 152): the id is now `<hostname>:<pid>:<nonce>` and is checked atomically, not "written and read back". A container's leftover lock has the container's hostname, so it is seen as cross-host from the host and never auto-broken there.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` and `command-surface.md`: only adjust wording where it contradicts the final API. `Lock` throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`), and the CLI's error layer maps that code. `ConfigError` is not introduced by #807. Keep the edits minimal.

## Files to Change
- `docs/agents/architecture/lock-system.md` — describe the new protocol.
- `docs/agents/architecture/docker-engine.md` — update the instance-id paragraph.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — reconcile the `LOCK_TIMEOUT` source with `LockTimeoutError`, if needed.
- `docs/agents/specs/arcanum-cli/command-surface.md` — same, only if needed.
