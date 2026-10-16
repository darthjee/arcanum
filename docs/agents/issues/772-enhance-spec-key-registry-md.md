# Issue: Enhance spec: key-registry.md

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic for the full design decisions.

Deepen and review the spec file `docs/agents/specs/arcanum-cli/key-registry.md` written in the "Write the arcanum CLI spec" sub-issue.

Focus for this file: registry file format and location/owner, the full initial entry list for every current key, wildcard matching, validation rules, `--force`, and how arcanum's own code/docs keep it in sync.

### Scope

- Resolve the open points recorded in this file.
- Cover, for what this file describes: edge cases, backward compatibility, testing strategy, performance & security considerations.
- Keep cross-links with the index and the other parts consistent; update the index's open-points list accordingly.
- Docs only — no code.

### Owner

`architect`.

### Dependencies

After "Write the arcanum CLI spec". Can run in parallel with the other "Enhance spec" sub-issues.

## Problem

`key-registry.md` was written as a first pass and leaves its core decisions open: file format, exact location and owner, wildcard matching rules, how arcanum's own code consumes the registry, how the "a new key means a registry entry" rule is enforced, and the final seed list (with the `setup`/`instances` input #777 needs). Its seed table is also incomplete and partly wrong versus what the runtime actually reads (missing `engine.log.location`, `git.omit_model_coauthor`, `git.remove_coauthors`; wrong tier for `engine.mode` and `git.safe_branch`; wrong implied default for `git.merge_body_mode`). The index's "per-key skew granularity" future-work pointer refers to this file, which does not yet cover it.

## Expected Behavior

`docs/agents/specs/arcanum-cli/key-registry.md` records every decision below, with no remaining open points it can settle itself; #777 can implement the registry from it without further design decisions. Cross-links with the index, [Command Surface](command-surface.md), [Shared Config Logic](shared-config-logic.md) and [Shortcuts and Setup](shortcuts-and-setup.md) stay consistent (e.g. Shared Config Logic's declared shared surface gains `keys.json` and `KeyRegistry.js`; docs describing `engine.mode` as repo-or-local only are corrected).

## Solution

Decisions to write into `key-registry.md` (docs only, owner `architect`):

### File format

Decided: a **plain JSON table**, not JSON Schema (it would need `ajv` at runtime, breaking core's zero-dependency rule, and most of what we need — tiers, read-only, `setup` — would live in `x-arcanum-*` extensions anyway) and not a JS module (unreadable from shell and docs; adding a key would become a code change). It is validated by a small hand-written validator in `core/lib`.

Shape rules:

1. **Top level**: `{"format_version": 1, "keys": [ ... ]}`. A consumer refuses a registry whose `format_version` is higher than it knows.
2. **Entries are an array**, not an object keyed by name — `JSON.parse` silently drops duplicate object keys, while an array lets a validator spec reject duplicate `key`s explicitly.
3. **Closed type vocabulary**: `string`, `boolean`, `number`, `enum` (requires `values`), `array` (requires `items`, one of the scalar types). No nested objects — every key is a leaf, matching what `config set` writes.
4. **`format`**: optional, closed vocabulary of extra string checks on top of `type`, starting with only `regex` (compiled with `new RegExp(v, 'i')`); for arrays it applies to each element. New formats are added in code, never as free-form patterns in the registry.
5. **`read_only`**: optional boolean, default `false`.
6. **`default`**: optional. Absent means no default, and `config get` reports `default: null`. When present it must match the entry's type (checked by the validator spec).
7. **Unknown entry fields are rejected** by the validator spec, so typos like `"teirs"` fail CI.
8. Other entry fields as already in the spec: `key` (may contain wildcard segments), `tiers`, `description`, optional `setup` (`{section, order, prompt, instances?}`).

Example:

```json
{
  "format_version": 1,
  "keys": [
    {
      "key": "git.merge_body_mode",
      "type": "enum",
      "values": ["full", "empty", "coauthors"],
      "tiers": ["global", "repo", "local"],
      "default": "full",
      "description": "PR merge body style"
    },
    {
      "key": "auto-fix-all.ignored_check_patterns",
      "type": "array",
      "items": "string",
      "format": "regex",
      "tiers": ["repo"],
      "default": [],
      "description": "Case-insensitive regexes of CI checks to ignore"
    }
  ]
}
```

### Location and owner

Decided: **`core/lib/utils/config/keys.json`**, owned by **`node`**, next to the existing config logic, with a loader/validator/matcher **`core/lib/utils/config/KeyRegistry.js`** beside it (specs under `core/spec/`).

- Both files join the **declared shared surface** of [Shared Config Logic](shared-config-logic.md), so the existing guardrails cover them as-is: esbuild bundling into `arcanum-cli`, the ESLint `no-restricted-imports` rule, and the CI coupling that runs CLI specs when a shared-surface file changes. No second path to add to filters or lists.
- `KeyRegistry.js` loads the file with a **static JSON import** (`import keys from './keys.json' with { type: 'json' }`, supported by core's `node >=22.13` ESM setup), never `fs.readFileSync` — esbuild inlines static JSON imports, so the bundled CLI carries the registry; a runtime file read would look for a file absent from the npm package.
- It ships with `core/` in the release zip and Docker image, so shell scripts can read it with `jq` if ever needed.
- No new root-level folder.
- `architect` owns the docs rule ("adding a config key means adding a registry entry"); `node` owns the file and its validator.

Alternatives rejected: `core/registry/` (cleaner data/code split, but adds a second path to the shared-surface list and CI filters); `arcanum/_lib/` (owned by `scripter`, splitting one feature across two agents and making the Node side reach into another agent's folder); a new root folder (new owner decision, roster and Docker changes for one file).

### Wildcard matching

Decided:

1. **Syntax**: a segment written `<name>` matches exactly **one** dotted segment. Whole segments only — no `*`, no partial segments (`foo_<x>`), no multi-segment wildcards. The name inside the brackets (`<agent>`, `<skill>`) is a label for docs and `--help`; it has no matching semantics.
2. **Concrete segment charset**: `[A-Za-z0-9_-]+` (dots are the path separator and can never appear). This covers every agent/skill name; e.g. `config set git.agents.foo.bar` is refused because the segment count doesn't match.
3. **Precedence**: a fully literal entry always beats a wildcard entry (allows a specific override such as `next_step.auto.arcanum-update` with its own type/default). Two **wildcard** entries that could match the same concrete key are rejected by the registry validator spec — so precedence never needs more than "exact beats wildcard".
4. **Leaf integrity**: the validator spec rejects an entry whose key is a prefix of another entry's key (e.g. `git.agents` alongside `git.agents.<agent>`). Every registered key is a leaf; `config set git.agents '{...}'` is refused as an unknown key, so a whole subtree can't be clobbered in one write without `--force`.
5. **No existence check on wildcard values**:
   - `<skill>`: any well-formed name is accepted — the CLI is installed independently and may be older or newer than arcanum, so it cannot reliably know the skill list.
   - `<agent>`: at repo/local tier, if the target repo has no `.claude/agents/<agent>.md`, the CLI prints a **warning** on stderr; the write still succeeds and the exit code is unchanged (the agent file may simply be added later).
6. **`setup.instances` is wizard-only**: it decides which concrete instances the wizard asks about, never which values are valid.

### Validation rules and `--force`

The generic contract (`--force` scope table, value parsing, exit `3`, error wording) is already settled in [Command Surface](command-surface.md) and is not duplicated here. Registry-specific decisions:

1. **Fixed check order**: known key → read-only → tier → value (type, format, range). The first failure wins, so error messages are deterministic. `unset` stops after the tier check (no value).
2. **Where checks live**: `KeyRegistry.js` exposes `lookup(key)` and `check(op, key, tier, value)`. `check` returns a structured result (e.g. `{ok: false, reason: 'type', expected, got}`) instead of throwing; the CLI maps it to its messages and exit `3`, and arcanum's own code can reuse it without depending on any CLI error type.
3. **Number constraints**: `number` entries may carry optional `integer: true`, `min`, `max` (the validator spec allows them only on `number`). Seed: `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` are `integer`, `min: 0`.
4. **Empty strings**: `string` and `enum` values must be non-empty unless the entry sets `allow_empty: true` (protects e.g. `git.safe_branch`, `git.email`). Arrays may be empty.
5. **`null` on a known key** is a type mismatch (exit `3`) with `hint: use 'config unset' to remove it`. Storing `null` (allowed by Command Surface's parsing table) is therefore only possible for unknown keys with `--force`.
6. **`format: regex`**: each array element is compiled with `new RegExp(p, 'i')`; a failure names the index and the compile error, e.g. `arcanum: auto-fix-all.ignored_check_patterns[2] is not a valid regex: Unterminated group`.
7. **`--force` on an unknown key** stores the parsed value as-is with no type check (already decided). The `<agent>` existence warning (see Wildcard matching) still prints under `--force`.
8. **Reads never validate**: `get` and `list` show stored values even when they violate the registry, mirroring how skills read them. Detecting such values (e.g. a `doctor` command) is out of scope for epic #767.

Entry-shape additions from this section: `integer`, `min`, `max` (number only), `allow_empty` (string/enum only).

### Keeping it in sync

Context: Node config reads go through `ConfigChain` / `RepoConfig` (mostly via `RepoContext.readConfig(scope, key)`, sometimes directly); shell reads all go through `config_chain_read <repo> <ns> <key...>` plus `repo_config_*` / `global_config_*` (`arcanum/_lib/`), with a uniform call shape (e.g. `config_chain_read "." "git" "agents.${agent}" "email"`).

#### How arcanum's own code consumes the registry

**Not at runtime in this epic.** Skills keep their hardcoded defaults (e.g. `DEFAULT_MAX_RETRY_COUNT` in `SpawnIssue.js`, `origin/main` in `safe_branch.sh`). A **drift spec** asserts each registry `default` equals the default the code actually applies: Node constants are exported and compared; shell defaults are checked by running the helper with no config present. Making code read defaults from the registry is a follow-up, outside epic #767 (no runtime coupling, no core churn now).

#### Enforcing "a new key means a registry entry"

Three layers:

1. **Node test-mode guard**: when `ARCANUM_STRICT_CONFIG_KEYS=1` (set by core's spec runner), **`ConfigChain#read` and `RepoConfig`'s read** (both on the shared surface) throw on a key that matches no registry entry. The guard sits there rather than in `RepoContext.readConfig` because some code bypasses `RepoContext` (e.g. `SafeBranch.js` uses `RepoConfig` directly; the auto-new-issue/auto-plan-issue commit commands use `ConfigChain` directly). Any spec exercising a read of an unregistered key fails. Production behavior is unchanged.
2. **Shell static scan**: a spec under `core/spec` scans `*.sh` for `config_chain_read`, `repo_config_read`/`repo_config_write`, `global_config_read`/`global_config_write` calls, builds the dotted key from `<ns>` + each `<key>` argument, treats a `${var}` segment as a wildcard segment, and fails if the key matches no registry entry. A call whose key cannot be parsed must carry a `# config-key: <key>` annotation on the preceding line, or the spec fails.
3. **Docs checklist**: "adding a config key means adding a `keys.json` entry" in `docs/agents/architecture/shared-state-and-configuration.md` and in the `node` / `scripter` agent docs.

No reverse check (registry entries nobody reads): too noisy with wildcards and migration-only keys.

### Full seed entry list

Decided: the **complete list is finalized in this spec**; #777 transcribes it into `keys.json` (descriptions, prompts, validator specs). Tiers and defaults below reflect what the runtime actually reads today (audit of every `config_chain_read` / `repo_config_*` / `global_config_*` call and every `core/lib` config read). "all" = global, repo, local.

| Key | Type | Tiers | Default | Notes |
| --- | --- | --- | --- | --- |
| `engine.mode` | enum `shell` / `native` / `docker` | all | `shell` | **Changed** from "repo or local": `config_chain_read` also honors the global tier |
| `engine.log.location` | string | all | — | **Added** (was missing); Docker engine log mount |
| `git.email` | string | all | — | address or `{agent}` pattern |
| `git.agents.<agent>` | string | all | — | per-agent email |
| `git.safe_branch` | string | **local only** | `origin/main` | **Changed**: `safe_branch.sh` reads only `.claude/state/arcanum-config.json` |
| `git.merge_body_mode` | enum `full` / `empty` / `coauthors` | all | **`empty`** | **Default fixed**: both `merge_body.sh` and `MergeBodyResolver` fall back to `empty` |
| `git.omit_model_coauthor` | boolean | all | `false` | **Added** (was missing; documented in README) |
| `git.remove_coauthors` | array of strings | all | `[]` | **Added** (was missing); emails removed from the coauthors list |
| `next_step.auto.<skill>` | boolean | all | `false` | only JSON `true` enables it |
| `auto-fix-all.ignored_check_patterns` | array of strings, `format: regex` | repo only | `[]` | each entry is a case-insensitive regex |
| `auto-fix-all.clear_context` | boolean | local only | `false` | routed to the state file |
| `auto-fix-all.finish_on_empty_queue` | boolean | local only | `false` | routed to the state file |
| `monitor-issues.clear_context` | boolean | local only | `false` | **added together with #776 only** — today it lives in `.claude/state/monitor-issues-config.json`, outside the tier files |
| `plan-issues.max-retry-count` | number, `integer`, `min: 0` | all | `5` | |
| `plan-issues.error-sleep-time` | number, `integer`, `min: 0` | all | `5` | seconds |
| `version` | string | repo | — | read-only, managed by migrations / `init-claude` |
| `migrations.version` | string | local | — | read-only, managed by the migrations runner |

`setup` fields mirror the wizard table in [Shortcuts and Setup](shortcuts-and-setup.md) exactly (`identity`: `git.email`, `git.agents.<agent>` with repo-derived instances; `engine`: `engine.mode`; `git`: `git.safe_branch`, `git.merge_body_mode`; `flow`: `next_step.auto.<skill>` with `instances: ["enhance-issue", "discuss-issue", "auto-plan-issue"]`; `ci`: `auto-fix-all.ignored_check_patterns`). No other entry carries `setup`.

Follow-ups for the spec edit: update the root README / `shared-state-and-configuration.md` where they describe `engine.mode` as repo-or-local only, and check whether the wizard/shortcut docs assume a `full` default for `git.merge_body_mode` or a non-local tier for `git.safe_branch` (the `git safe-branch` shortcut's default tier is already `local`).

### Per-key skew granularity (future work)

Decided: **stays future work, outside epic #767**, as the index already says — but the intended design is recorded in `key-registry.md` so the follow-up starts from it:

1. **Fields (not part of `format_version: 1`)**: `since: "<version>"` (arcanum version that introduced the key); `moved_in: {"version": "<version>", "from": "<old key>"}` (version whose migration moved/renamed the key); possibly `removed_in: "<version>"` as a tombstone entry so the CLI can explain why an old key is refused.
2. **Intended behavior**: on a write, if the target tier's pointer is below an entry's `moved_in.version` (the move migration is still pending), refuse with version-skew exit `5`, `hint: run /arcanum-migrate first`, bypassable with `--force`. Writes to the old `from` key are treated the same. This upgrades today's "tier behind" warning to a refusal, per key.
3. **Why not now**: no migration so far moved a key in a way a CLI write would race; the pending-migrations warning covers the common case; extra fields add authoring burden to every entry.
4. **Cheap to add later**: the registry is bundled, so a CLI only ever reads the registry it was built with — new fields need a validator/code change but **no `format_version` bump** (only needed if the registry is ever read at runtime from outside the bundle). Since unknown fields are rejected, nobody can add them early by accident.

### Scope boundaries (this spec vs #777)

- **This spec (#772)** decides everything: entry shape, location, wildcard matching, validation rules, sync/enforcement, and the full seed list.
- **#777** implements it: `keys.json`, `KeyRegistry.js`, the registry validator specs, the drift spec, the Node strict-keys guard and shell scan spec, and the docs checklist line.
- The CLI's use of the registry (messages, exit codes, `list`, `--help`, wizard) belongs to the later `cli/` issues.

### Edge cases

- Dashed segments (`plan-issues.max-retry-count`, `auto-fix-all.*`) need nothing special — covered by the segment charset.
- Top-level un-namespaced keys (`version`): a single-segment key is valid.
- `--force` on a **known** key still runs every check; it only bypasses unknown-key and version-skew refusals.
- A namespace alone (`config set git '{...}'`) is unknown under the leaf rule → needs `--force`.
- An invalid registry is a build-time failure (specs + a validation step in the CLI build), never a runtime path in the installed CLI.

### Backward compatibility

- Skills are unaffected: no runtime consumption in this epic.
- The tier/default corrections in the seed list document existing runtime behavior; nothing changes behavior.
- An older CLI meeting newer keys is covered by `--force` plus the existing version-skew rules.
- The registry format is internal (not a public contract); the CLI's exit codes and JSON shapes remain the public contract as already decided in [Command Surface](command-surface.md).

### Testing strategy

- `KeyRegistry` spec: matching (exact beats wildcard, segment count, charset) and `check` — one case per reason: unknown, read-only, tier, type, enum, empty string, `integer`/`min`/`max`, regex with element index, `null`.
- Registry validator spec over the real `keys.json`: unknown fields, duplicate keys, overlapping wildcards, prefix/leaf violations, `default` not matching its type, field-scope rules (`integer`/`min`/`max` only on `number`, `allow_empty` only on `string`/`enum`, `format` vocabulary), `setup.section` within the canonical set.
- The drift spec (registry defaults vs code defaults), the Node strict-keys guard active in every core spec run, and the shell scan spec.

### Performance & security

- ~20 entries inlined in the bundle; lookups are a linear scan with no I/O — nothing to optimize.
- User-supplied `regex` values are only compiled to validate them. `ignored_check_patterns` is a pre-existing ReDoS surface at runtime in `auto-fix-all`; noted in the spec, out of scope here.
- The registry is data, never executed.

### Migration needed?

No. The registry is a new file inside `core/`; no tier-file shape changes; the seed-list corrections document existing behavior. Nothing under `arcanum/migrations/repos/`.

### Script-driven interaction?

Not applicable — docs-only spec; the registry has no interactive flow.

### New root-level folder?

No — the registry lives in `core/lib/utils/config/`, owned by `node`.

## Benefits

- #777 becomes a pure implementation task with a complete, audited key list.
- Registry drift from what arcanum actually reads is caught by specs (Node strict-keys guard, shell scan, defaults drift spec), not by users.
- Zero new runtime dependencies; the registry rides the existing shared-surface guardrails.
