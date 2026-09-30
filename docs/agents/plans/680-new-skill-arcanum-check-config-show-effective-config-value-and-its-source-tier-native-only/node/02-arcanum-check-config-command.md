# ArcanumCheckConfig command and registration
Create `core/lib/commands/arcanum-check-config/ArcanumCheckConfig.js`, constructed with a `RepoContext` (`context: 'repo'`), following the existing command classes' constructor/DI patterns (e.g. `core/lib/commands/shared/ListAgents.js`, `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`). Get the `ConfigChain` from an injectable dep, defaulting to `new ConfigChain({ repoContext })` so the global tier reads `process.env` (which, under `engine_dispatch`, only holds the forwarded `HOME`/`CLAUDE_CONFIG_DIR`).

`run(key)`:
1. Validate `key` per C1: throw `new Error('Usage: /arcanum-check-config <namespace.key[.sub...]>')` when missing/empty, and `new Error("invalid key '<key>': expected <namespace.key[.sub...]>")` when it has no `.` or any empty segment.
2. Split into `namespace` (first segment) and the nested key (remaining segments joined with `.`).
3. Call `configChain.readTiers(repoContext.repoPath, namespace, nestedKey)`.
4. Build `{ key, local, repo, global, final }` exactly as in C1 (per tier: `file`, `set`, and `value` only when set; `final` from the first set tier, else `{ value: null, source: null }`).
5. Return `JSON.stringify(result, null, 2) + '\n'` (`core/bin/arcanum` writes returned strings to stdout).

Register it in `core/lib/core/commands.js` as the **first** `COMMANDS` entry (C1), and add `arcanum-check-config` to the JSDoc paragraph listing `context: 'repo'` / `validateRepoPath: false` commands. Add `'arcanum-check-config'` as the first element of `REPO_CONTEXT_COMMANDS` in `core/spec/lib/core/commands_spec.js` (the spec compares insertion order).

Add `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js` (real temp-dir tier files, or a fake `ConfigChain`):
- exact JSON string for: repo set and global set (global shadowed, `final.source` `repo`); local set only; no tier set (`final` null/null); `""` in local winning over a set repo tier;
- object and array values emitted as subtrees; scalar values as scalars;
- global `file` `null` when the env has neither `HOME` nor `CLAUDE_CONFIG_DIR`;
- both error messages (missing key, malformed keys `git`, `git.`, `.x`, `a..b`).

## Files to Change
- `core/lib/commands/arcanum-check-config/ArcanumCheckConfig.js` — new command.
- `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js` — new spec.
- `core/lib/core/commands.js` — register `arcanum-check-config` first; update the JSDoc.
- `core/spec/lib/core/commands_spec.js` — add `arcanum-check-config` to `REPO_CONTEXT_COMMANDS`.
