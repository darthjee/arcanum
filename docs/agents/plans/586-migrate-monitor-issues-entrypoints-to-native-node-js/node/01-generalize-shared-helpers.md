# Generalize QueueStore and extract a shared config helper

**QueueStore**: add optional constructor parameters for the queue and lock file names, for example `new QueueStore(repoContext, { queueFile: 'monitor-issues-rewrite-queue.json', lockFile: 'monitor-issues-rewrite-queue.lock' })`, both resolved under `<repoPath>/.claude/state/`. The defaults stay the auto-fix-all names, so `AutoFixAllQueue` doesn't change. Rewrite the doc comment so it no longer says the store is auto-fix-all only.

**Shared config helper**: extract what `AutoFixAllConfig` and the monitor-issues config have in common into a new `core/lib/utils/config/` class, e.g. `BooleanKeyConfig`:
- a per-key file resolver that each namespace supplies (auto-fix-all: its `STATE_KEYS` + new/legacy `repo_config.sh` split; monitor-issues: `clear_context` → `.claude/state/monitor-issues-config.json`, else `.claude/configuration/monitor-issues.json`)
- `_readJson` with absent/empty file treated as `{}`, value resolution with `// false` semantics, lock-guarded `set`/`toggle` using `Lock.js` and tmp-file + rename writes
- `true|false` value validation and its error messages

Then rewrite `AutoFixAllConfig` on top of it. Its public API and behaviour stay the same.

## Files to Change
- `core/lib/utils/queue/QueueStore.js` — configurable file names
- `core/lib/utils/config/BooleanKeyConfig.js` (name at implementer's discretion) — new
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` — delegate to the helper
- `core/spec/lib/utils/queue/QueueStore_spec.js`, `core/spec/lib/utils/config/BooleanKeyConfig_spec.js` — specs
