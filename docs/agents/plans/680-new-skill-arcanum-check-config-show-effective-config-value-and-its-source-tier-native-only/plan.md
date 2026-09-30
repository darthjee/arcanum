# Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Issue: [680-new-skill-arcanum-check-config-show-effective-config-value-and-its-source-tier-native-only.md](../../issues/680-new-skill-arcanum-check-config-show-effective-config-value-and-its-source-tier-native-only.md)

## Overview
Add `/arcanum-check-config <key>`, the first **native-only** skill. It prints JSON showing what each arcanum config tier (local → repo → global) holds for a dotted key, plus the final resolved value and its source tier. `node` adds an origin-aware per-tier read to `ConfigChain` (shared with `read()`), the `arcanum-check-config` native command and its specs. `scripter` adds a reusable `--native-only` mode to `arcanum/_lib/engine_dispatch.sh` (no shell fallback, no `migration-status.json` lookup) and the skill's thin shim. `skill-writer` writes `SKILL.md`. The architect then updates the docs: existing entrypoints stay dual (shell + native), and **new skills are native-only**, with docker added later. Everything ships in one PR.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

### C1 — native command `arcanum-check-config`
- Registry entry in `core/lib/core/commands.js`, inserted as the **first** entry of `COMMANDS` (alphabetical, ahead of `arcanum-split-issue-*`):
  `'arcanum-check-config': { module: 'commands/arcanum-check-config/ArcanumCheckConfig.js', method: 'run', context: 'repo', validateRepoPath: false }`.
  `validateRepoPath: false` because the tiers are plain files: the target does not need to be a git repo.
- Invocation: `core/bin/arcanum arcanum-check-config <repo_path> <key>`. The dispatcher consumes `<repo_path>` into the `RepoContext`; `run(key)` receives only `<key>`.
- `<key>` is a dotted path `namespace.key[.sub...]`: the first segment is the namespace, the remaining segments (joined back with `.`) are the nested key passed to `ConfigChain`'s existing `_resolveKey`. A key must have at least two non-empty segments.
- Errors (thrown as a plain `Error`, so `core/bin/arcanum` prints `arcanum: <message>` on stderr, nothing on stdout, exit `1`):
  - missing/empty `<key>`: `Usage: /arcanum-check-config <namespace.key[.sub...]>`;
  - malformed `<key>` (no `.`, or any empty segment such as `git.`, `.x`, `a..b`): `invalid key '<key>': expected <namespace.key[.sub...]>`.
- Success: stdout is `JSON.stringify(result, null, 2) + '\n'`, exit `0`. Key order is fixed:
  ```json
  {
    "key": "git.authors",
    "local":  { "file": "/abs/repo/.claude/state/arcanum-config.json", "set": false },
    "repo":   { "file": "/abs/repo/.claude/configuration/arcanum-repo-config.json", "set": true, "value": ["..."] },
    "global": { "file": "/Users/me/.claude/arcanum-config.json", "set": true, "value": ["..."] },
    "final":  { "value": ["..."], "source": "repo" }
  }
  ```
  - `key` echoes the argument verbatim.
  - `file`: the tier's path from `ConfigChain#_tierFiles`, made absolute with `path.resolve` (no symlink resolution, never shortened to `~`). The global path honors `CLAUDE_CONFIG_DIR`, then `$HOME/.claude`; it is `null` when neither env var is set.
  - `set: true` plus `value` (the raw JSON value: scalar, object or array subtree) when the tier holds a present, non-`null` value. An empty string `""` counts as set.
  - `set: false` and **no** `value` key when the value is absent or `null`, the file is missing/unreadable/malformed/not an object, or the global path is `null`.
  - Every tier is always reported, including shadowed ones.
  - `final.source` is the name (`local`/`repo`/`global`) of the first tier with `set: true`, and `final.value` is that tier's value. No tier set → `"final": { "value": null, "source": null }`. Code-level defaults (e.g. `engine.mode` → `shell`) are never reported.
- The global tier is resolved from the process env, so the shim must forward `HOME` and `CLAUDE_CONFIG_DIR` (C3).

### C2 — native-only dispatch in `arcanum/_lib/engine_dispatch.sh`
- New literal flag `--native-only`, recognized in the same flag/env-var-name segment as `--prepend-repo-path` (anywhere before `--`).
- With `--native-only`, the `<shell_script>` positional is passed as an empty string `""` and is never run.
- Resolution with `--native-only`:
  - `engine.mode` unset (default `shell`), `shell`, or `native` (or any other non-`docker` value) → runs `core/bin/arcanum <command> ...` exactly as the existing native branch does: same `env -i PATH ARCANUM_REPO_PATH` + allowlist rules, same `--prepend-repo-path` handling. The native exit code is propagated.
  - `engine.mode=docker` → prints `Error: engine.mode=docker is not implemented yet for native-only command '<command>'.` on stderr and returns `1`. No fallback, nothing on stdout.
  - `arcanum/_lib/migration-status.json` is **not** consulted. Native-only commands are **not** added to it.
- Without `--native-only`, behavior is byte-for-byte unchanged.

### C3 — skill shim `arcanum-check-config/scripts/check_config.sh`
- Usage: `check_config.sh <repo_path> <key>`.
- Empty/missing `<repo_path>` or `<key>` → `Usage: <script> <repo_path> <namespace.key[.sub...]>` on stderr, exit `1`, nothing on stdout.
- Otherwise: `engine_dispatch "$REPO_PATH" arcanum-check-config "" --native-only HOME CLAUDE_CONFIG_DIR -- "$REPO_PATH" "$KEY"`. `<repo_path>` is forwarded as the first native argument (consumed by the `context: 'repo'` dispatcher), so `--prepend-repo-path` is not used.
- stdout, stderr and exit code pass through unchanged from C1/C2.

## Execution order
1. `node` and `scripter` are independent: they meet only at C1/C2/C3. `node`'s bin-level routing spec (node step 03) runs the real shim, so it needs `scripter`'s work in the tree before it can pass.
2. `skill-writer` depends only on C3's path and output.
3. Architect docs follow-up (below) goes last.

## Architect follow-up (docs, after the specialists land)
The architect owns these files and does this part itself:
- `AGENTS.md`: Stack section and the Conventions/Boundaries rules about extracting logic into `<skill>/scripts/*.sh`. Existing entrypoints stay dual (shell + native); new skills are native-only (a `core/lib` command behind a thin `--native-only` shim), with docker added later.
- `docs/agents/architecture/script-engine.md`: document `--native-only` (C2) in "The dispatch guard", "The output/exit-code contract" (no shell counterpart to be byte-identical with) and "Testing conventions" (no parity spec for native-only commands; a routing spec through the real shim instead). If #655 has landed, rewrite its "Adding a new entrypoint" section to the new rule; otherwise only cross-reference #655.
- `docs/agents/architecture/script-preference.md`: its "must live in shell scripts" rule. For new skills, deterministic logic lives in `core/lib`, reached through a `<skill>/scripts/*.sh` shim.
- `docs/agents/specs/shell-engine-removal.md`: native-only commands have no shell side to remove and are not in `migration-status.json`; the removal's "shell branch" cleanup must keep the `--native-only` path (which already treats `shell` like `native`).
- `.claude/agents/node.md`, `.claude/agents/scripter.md`, `.claude/agents/architect.md`, `docs/agents/architecture/agent-roster-and-delegation.md`: ownership of a native-only skill — `node` owns the `core/lib` command and its specs (no parity spec), `scripter` owns the `--native-only` shim, `skill-writer` owns `SKILL.md`. Soften `node.md`'s "every migrated entrypoint needs a parity test" to exclude native-only commands.
- `docs/agents/folder-structure.md`: add an `arcanum-check-config/` row, and describe the shim → `engine_dispatch --native-only` → native variant.
- `docs/agents/architecture/skill-finish.md`: add `arcanum-check-config` to the "Out of scope" list (read-only single-shot query, no report), and mention the native-only variant next to the shim → dispatch → shell/native pattern.
- `docs/agents/architecture/entrypoint-migration-status.md` (auto-generated): native-only commands are intentionally absent from `migration-status.json`, so they never appear in this table. Have `scripter` add one sentence saying so to the static intro text in `scripts/generate_entrypoint_migration_status.sh`, then regenerate the doc with that script (never hand-edit it).
- `docs/agents/architecture/shared-state-and-configuration.md`: point to `/arcanum-check-config` as the way to debug where a config value comes from.
- `README.md`: add `/arcanum-check-config` to the "Available skills" table.

## Notes
- #655 is still open and left as is. Do not pull in its "every new entrypoint must be dual shell+native" rule; whichever of #655 / #680 lands second reconciles the docs.
- Scope is only the three-tier arcanum config chain. Other config files (e.g. `.claude/configuration/monitor-issues.json`) are out of scope.
- A previous plan for this issue exists on the `issue-680` branch (commit `2773040`, written before the issue was refined). This plan supersedes it; notable corrections: usage errors go through a plain `Error` (stderr), not `DispatchFailure` (which writes stdout), and a namespace-only key is rejected rather than returning the whole namespace.
