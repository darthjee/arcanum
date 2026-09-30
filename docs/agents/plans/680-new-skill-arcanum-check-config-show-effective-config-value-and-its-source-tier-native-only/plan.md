# Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Issue: [680-new-skill-arcanum-check-config-show-effective-config-value-and-its-source-tier-native-only.md](../../issues/680-new-skill-arcanum-check-config-show-effective-config-value-and-its-source-tier-native-only.md)

## Overview
Add `/arcanum-check-config <key>`, the first **native-only** skill. It prints, as JSON, what each config tier (local → repo → global) holds for a key, plus the final resolved value and its source tier. The node agent adds a per-tier read to `ConfigChain` and a new native command. The scripter adds a reusable `--native-only` mode to `engine_dispatch.sh` and the skill's shim. The skill-writer writes the `SKILL.md`. The architect then updates the docs to the new rule: existing entrypoints stay dual (shell + native), and new skills are native-only, with docker added later.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

### C1 — native command `arcanum-check-config`
- Registered in `core/lib/core/commands.js` as `'arcanum-check-config': { module: 'commands/arcanum-check-config/ArcanumCheckConfig.js', method: 'run', context: 'repo', validateRepoPath: false }`. `validateRepoPath: false` because the config tiers are plain files and the target doesn't need to be a git repo.
- Invocation: `core/bin/arcanum arcanum-check-config <repo_path> <key>`.
- `<key>` is a dotted path. The first segment is the namespace and the rest (if any) is the nested key, resolved with `ConfigChain`'s existing `_resolveKey` semantics. A key with only a namespace (e.g. `git`) resolves to the whole namespace section.
- Missing/empty `<key>`: prints `Usage: /arcanum-check-config <namespace.key[.sub...]>` to stderr and exits `1` (via `DispatchFailure`), with nothing on stdout.
- Success: prints pretty-printed JSON (2-space indent, trailing newline) to stdout and exits `0`:
  ```json
  {
    "key": "git.authors",
    "local":  { "file": "/abs/repo/.claude/state/arcanum-config.json", "set": false },
    "repo":   { "file": "/abs/repo/.claude/configuration/arcanum-repo-config.json", "set": true, "value": ["..."] },
    "global": { "file": "/Users/me/.claude/arcanum-config.json", "set": true, "value": ["..."] },
    "final":  { "value": ["..."], "source": "repo" }
  }
  ```
  - Tier order and names are fixed: `local`, `repo`, `global`.
  - `file` is the absolute path `ConfigChain#_tierFiles` returns. For `global` it is `null` when neither `CLAUDE_CONFIG_DIR` nor `HOME` is set.
  - `set: true` + `value` (raw JSON: scalar, object or array) when the tier has a present, non-`null` value. `""` counts as set.
  - `set: false` and **no** `value` key when the value is absent/`null`, or the file is missing/unreadable/malformed/not an object.
  - `final.source` is the first tier with `set: true`. When none: `"final": { "value": null, "source": null }`. Code defaults are never reported.
- Global-tier resolution reads `HOME` / `CLAUDE_CONFIG_DIR` from the process env, so the dispatch shim **must** forward both (C2).

### C2 — native-only dispatch in `arcanum/_lib/engine_dispatch.sh`
- New literal flag `--native-only`, recognized in the same env-var-name segment as `--prepend-repo-path` (before `--`).
- With `--native-only`, `<shell_script>` is passed as an empty string `""` and is never run.
- Resolution with `--native-only`:
  - `engine.mode` = `shell` (including the unset default) or `native` → runs `core/bin/arcanum <command> ...` exactly like today's native branch (same `env -i` + allowlist + `ARCANUM_REPO_PATH` rules, same `--prepend-repo-path` handling). Exit code propagated.
  - `engine.mode=docker` → prints `Error: engine.mode=docker is not implemented yet for native-only command '<command>'.` to stderr and returns `1`, with no fallback.
  - `migration-status.json` is **not** consulted, and native-only commands are **not** added to it (so they don't appear in `entrypoint-migration-status.md`).
- Without `--native-only`, behavior is byte-for-byte unchanged.

### C3 — skill shim `arcanum-check-config/scripts/check_config.sh`
- Usage: `check_config.sh <repo_path> <key>`.
- Missing `<repo_path>` → `Usage: $0 <repo_path> <key>` on stderr, exit 1. The key check is left to the native side (C1).
- Calls `engine_dispatch "$REPO_PATH" arcanum-check-config "" --native-only HOME CLAUDE_CONFIG_DIR -- "$@"`: `<repo_path>` stays the first forwarded arg, which the `context: 'repo'` dispatcher consumes.
- stdout/stderr/exit code are passed through unchanged from C1/C2.

## Architect follow-up (docs, after the specialists land)
The coordinator (architect) owns root-level docs, so it does this part itself once the three specialists are done:
- `AGENTS.md`: Stack section and the Conventions/Boundaries rules about extracting logic into `<skill>/scripts/*.sh`. New skills are native-only (a `core/lib` command plus a thin `--native-only` shim). Existing entrypoints stay dual.
- `docs/agents/architecture/script-engine.md`: document `--native-only` (C2) in the dispatch guard, output/exit contract and testing/parity sections. Parity tests don't apply to native-only commands. If #655 has landed by then, rewrite its "Adding a new entrypoint" section.
- `docs/agents/architecture/script-preference.md`: relax the "must live in shell scripts" rule for new skills (deterministic logic lives in `core/lib`, behind a shim).
- `docs/agents/specs/shell-engine-removal.md`: note that native-only skills have no shell side to remove.
- `.claude/agents/node.md`, `.claude/agents/scripter.md`, `.claude/agents/architect.md`, `docs/agents/architecture/agent-roster-and-delegation.md`: ownership of a native-only skill. `node` owns the `core/lib` command and specs, `scripter` owns the `--native-only` shim, `skill-writer` owns `SKILL.md`.
- `docs/agents/folder-structure.md`, `docs/agents/architecture/skill-finish.md`: add the shim → dispatch(`--native-only`) → native variant next to the shim → dispatch → shell/native pattern.
- `docs/agents/architecture/entrypoint-migration-status.md`: native-only commands are intentionally absent from `migration-status.json`, so they don't appear in this generated table. Add a sentence saying so to the generator's header text (`scripts/generate_entrypoint_migration_status.sh`) so the note survives regeneration.
- `README.md`: add `/arcanum-check-config` to the "Available skills" table.

## Notes
- Execution order: node and scripter are independent (they meet only at C1/C2/C3). skill-writer depends on C3's script path only. The architect docs follow-up goes last.
- #655 is still open. Don't pull its "dual shell+native" rule in. Just make sure these docs state the new rule.
