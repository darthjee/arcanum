# Issue: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

## Description
Add an `/arcanum-check-config <key>` skill (e.g. `/arcanum-check-config git.authors`). It prints JSON showing what each config tier holds for the key and the final resolved value.

It is the first **native-only** skill: no shell implementation, with docker support to come later. From now on every new skill follows the same rule, so this issue also updates the docs and adds a reusable native-only dispatch path.

## Problem
Arcanum config is resolved across three tiers (local state → repo config → global config), and nothing shows which tier a value comes from or what a higher tier is shadowing. Debugging a surprising value means opening three JSON files by hand and re-applying the resolution rules mentally.

On top of that, `arcanum/_lib/engine_dispatch.sh` always assumes a `<shell_script>` fallback, and `engine.mode` defaults to `shell`. A skill with no shell implementation has no way to go through dispatch as it stands.

## Expected Behavior
- **Input:** one dotted key path, `namespace.key[.sub...]` (the first segment is the namespace, the rest is the nested key, same as `ConfigChain#read`).
- **No key argument:** print usage to stderr and exit non-zero.
- **Output:** JSON with one entry per tier, in resolution order, plus the final evaluation:
  ```json
  {
    "key": "git.authors",
    "local":  { "file": "<repo>/.claude/state/arcanum-config.json", "set": false },
    "repo":   { "file": "<repo>/.claude/configuration/arcanum-repo-config.json", "set": true, "value": ["..."] },
    "global": { "file": "~/.claude/arcanum-config.json", "set": true, "value": ["..."] },
    "final":  { "value": ["..."], "source": "repo" }
  }
  ```
  - `value` is the raw JSON value: a scalar when the key holds a scalar, the JSON subtree when it holds an object or array.
  - Shadowed tiers are still shown, so you can see what was overridden. A tier with no value for the key (absent, `null`, missing/unreadable/malformed file, or an unresolvable global path) gets `"set": false` and no `value`.
  - When no tier sets the key, `final` is `{ "value": null, "source": null }`. Code-level defaults (e.g. `engine.mode` → `shell` in `engine_dispatch.sh`) are **not** reported.
- **Resolution matches the existing chain exactly:**
  - order is local → repo → global;
  - the first value that is present and not `null` wins;
  - an empty string `""` counts as a real value;
  - tiers are never merged.
- **Scope:** only the three-tier arcanum config chain. Keys in other config files (e.g. `.claude/configuration/monitor-issues.json`) are out of scope.

## Solution
### Native command
- Add a `core/lib` command registered in `core/lib/core/commands.js`, invoked through `core/bin/arcanum`.
- Reuse `ConfigChain` (`core/lib/utils/config/ConfigChain.js`): `_tierFiles()` already returns the ordered tier paths. Add a per-tier, origin-aware read (e.g. a method returning each tier's file/set/value) and have `read()` share the same resolution code, so the logic isn't duplicated.

### Native-only dispatch (option b)
- Extend `arcanum/_lib/engine_dispatch.sh` with a native-only path (e.g. a flag or an empty `<shell_script>`) with no shell fallback:
  - `engine.mode=shell` and `engine.mode=native` both run `core/bin/arcanum`;
  - `engine.mode=docker` exits with an error until docker is implemented;
  - the `migration-status.json` availability check doesn't apply (there is no shell side to fall back to).
- The skill's shim script uses this path. Every future native-only skill reuses it.

### Docs: new skills are native-only
Related to #655 (still open), which adds an "every new entrypoint must be dual shell+native" rule. This issue replaces that rule with: existing entrypoints stay dual (shell + native), and **new skills are native-only, with docker added later**. Files to update:
- `AGENTS.md`: Stack section and the Conventions/Boundaries rules about extracting logic into `<skill>/scripts/*.sh`.
- `docs/agents/architecture/script-engine.md`:
  - the dispatch guard, contract and parity-test sections (document the native-only path);
  - #655's "Adding a new entrypoint" section, if it has landed by then.
- `docs/agents/architecture/script-preference.md`: its "must live in shell scripts" rule.
- `docs/agents/specs/shell-engine-removal.md`.
- `.claude/agents/node.md`, `.claude/agents/scripter.md`, `.claude/agents/architect.md` and `docs/agents/architecture/agent-roster-and-delegation.md`: who owns a native-only skill.
- `docs/agents/folder-structure.md` and `docs/agents/architecture/skill-finish.md`: they describe the shim → dispatch → shell/native pattern.
- `docs/agents/architecture/entrypoint-migration-status.md` (auto-generated): decide how native-only commands appear, or whether they are dropped along with #655.
- `README.md`: list the new skill.

## Benefits
- One command shows where a config value comes from and what it shadows, with no manual inspection of three files.
- Sets up a reusable native-only dispatch path and documents the new-skills-are-native-only rule, so later skills don't need a shell twin.
