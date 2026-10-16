# Arcanum CLI: Key Registry

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the shared, machine-readable registry of known arcanum config keys. The CLI uses it to validate writes and to drive listing, help, the wizard and the shortcuts. Arcanum's own code and docs can use the same definitions.

This part decides everything about the registry: its format, location and owner, wildcard matching, validation rules, how it stays in sync with what arcanum reads, and the full seed list. #777 implements it without further design decisions. The CLI's use of it (messages, exit codes, `list`, `--help`, the wizard) belongs to the later `cli/` issues.

## Decisions

### Entry shape

The registry is a **plain JSON table**, not a JSON Schema and not a JS module (see [Alternatives considered](#alternatives-considered)). A small hand-written validator in `core/lib` checks it.

Shape rules:

1. **Top level**: `{"format_version": 1, "keys": [ ... ]}`. A consumer refuses a registry whose `format_version` is higher than it knows.
2. **Entries are an array**, not an object keyed by name. `JSON.parse` silently drops duplicate object keys; an array lets the validator spec reject a duplicate `key` explicitly.
3. **Closed type vocabulary**:
   - `string`, `boolean`, `number`;
   - `enum`, which requires `values` (the allowed strings);
   - `array`, which requires `items` (one of the scalar types `string`, `boolean`, `number`).

   There is no object type: every key is a leaf, matching what `config set` writes.
4. **`format`** (optional): a closed vocabulary of extra string checks on top of `type`. It starts with only `regex`, compiled with `new RegExp(v, 'i')`. On an array it applies to each element. New formats are added in code, never as free-form patterns in the registry.
5. **`read_only`** (optional): boolean, default `false`.
6. **`default`** (optional): absent means no default, and `config get` reports `"default": null`. When present it must match the entry's type, which the validator spec checks.
7. **Number constraints** (optional, `number` only): `integer: true`, `min`, `max`.
8. **`allow_empty`** (optional, `string` and `enum` only): see [Validation](#validation).
9. **Required fields**: `key` (may contain [wildcard segments](#wildcard-matching)), `type`, `tiers` (a non-empty subset of `global`, `repo`, `local`), `description`.
10. **`setup`** (optional): `{section, order, prompt, instances?}`, for keys the [`config setup` wizard](shortcuts-and-setup.md#arcanum-config-setup-wizard) asks (see below).
11. **Unknown entry fields are rejected** by the validator spec, so a typo such as `"teirs"` fails CI.

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
      "default": "empty",
      "description": "PR merge body style",
      "setup": {"section": "git", "order": 2, "prompt": "Squash-merge commit body"}
    },
    {
      "key": "auto-fix-all.ignored_check_patterns",
      "type": "array",
      "items": "string",
      "format": "regex",
      "tiers": ["repo"],
      "default": [],
      "description": "Case-insensitive regexes of CI checks to ignore",
      "setup": {"section": "ci", "order": 1, "prompt": "CI checks to ignore"}
    }
  ]
}
```

The `default` value feeds the `default` field of `config get` and of the shortcuts' reads (see [Command Surface](command-surface.md#json-output)).

The `setup` field:

- The wizard asks exactly the entries that carry it, ordered by `section` (in the canonical order `identity`, `engine`, `git`, `flow`, `ci`), then by `order`. `prompt` is the question shown. A `section` outside the canonical list fails the validator spec.
- `instances` lists the concrete names to ask for a wildcard key, e.g. `next_step.auto.<skill>` → `enhance-issue`, `discuss-issue`, `auto-plan-issue`. It is **wizard-only**: it decides which instances the wizard asks about, never which values are valid.
- `git.agents.<agent>` is the exception: its instances come from the target repo's `.claude/agents/*.md`, not from the registry, so its `setup` has no `instances`.
- Adding a key to the wizard is a registry edit, not CLI code.

### Location

- The registry is **`core/lib/utils/config/keys.json`**, owned by **`node`**, next to the existing config logic. A loader, validator and matcher, **`core/lib/utils/config/KeyRegistry.js`**, sits beside it; its specs live under `core/spec/`.
- Both files join the **declared shared surface** of [Shared Config Logic](shared-config-logic.md#guardrails), so the existing guardrails cover them as they are: `esbuild` bundling into `arcanum-cli`, the ESLint `no-restricted-imports` rule, and the CI coupling that runs the CLI specs when a shared-surface file changes. No second path is added to any filter or list.
- `KeyRegistry.js` loads the file with a **static JSON import**, `import keys from './keys.json' with { type: 'json' }`, which core's `node >=22.13` ESM setup supports. It never uses `fs.readFileSync`: `esbuild` inlines static JSON imports, so the bundled CLI carries the registry, whereas a runtime file read would look for a file that is absent from the npm package.
- It is **packed into the `arcanum-cli` npm package at build time** by that bundling. The installed CLI is self-contained and never reads the registry from an arcanum install.
- It ships with `core/` in the release zip and the Docker image, so shell scripts can read it with `jq` if they ever need to.
- No new root-level folder.
- `architect` owns the docs rule ("adding a config key means adding a registry entry", see [Keeping it in sync](#keeping-it-in-sync)); `node` owns the file and its validator.

### Wildcard matching

1. **Syntax.** A segment written `<name>` matches exactly **one** dotted segment. Whole segments only: no `*`, no partial segments (`foo_<x>`), no multi-segment wildcards. The name inside the brackets (`<agent>`, `<skill>`) is a label for docs and `--help`; it has no matching semantics.
2. **Concrete segment charset.** A concrete segment matches `[A-Za-z0-9_-]+`. Dots are the path separator and can never appear inside a segment. This covers every agent and skill name. `config set git.agents.foo.bar` is refused as unknown because the segment count does not match `git.agents.<agent>`.
3. **Precedence.** A fully literal entry always beats a wildcard entry, which allows a specific override such as `next_step.auto.arcanum-update` with its own type or default. Two **wildcard** entries that could match the same concrete key are rejected by the validator spec, so precedence never needs more than "exact beats wildcard".
4. **Leaf integrity.** The validator spec rejects an entry whose key is a prefix of another entry's key, e.g. `git.agents` alongside `git.agents.<agent>`. Every registered key is a leaf, so `config set git.agents '{...}'` is refused as an unknown key and a whole subtree cannot be clobbered in one write without `--force`.
5. **No existence check on wildcard values.**
   - `<skill>`: any well-formed name is accepted. The CLI is installed independently and may be older or newer than arcanum, so it cannot reliably know the skill list.
   - `<agent>`: at the repo or local tier, if the target repo has no `.claude/agents/<agent>.md`, the CLI prints a **warning** on stderr. The write still succeeds and the exit code is unchanged: the agent file may simply be added later.
6. **`setup.instances` is wizard-only** (see [Entry shape](#entry-shape)).

### Validation

The generic contract is settled in [Command Surface](command-surface.md): the [`--force` scope](command-surface.md#--force-scope) table, [value parsing](command-surface.md#value-parsing), [exit `3`](command-surface.md#exit-codes) and the [error wording](command-surface.md#error-messages). It is not restated here. The registry-specific decisions are:

1. **Fixed check order**: known key → read-only → tier → value (type, enum, format, range). The first failure wins, so error messages are deterministic. `unset` stops after the tier check, as there is no value.
2. **Where checks live.** `KeyRegistry.js` exposes `lookup(key)` and `check(op, key, tier, value)`. `check` returns a structured result, e.g. `{ok: false, reason: 'type', expected, got}`, instead of throwing. The CLI maps it to its messages and exit `3`, and arcanum's own code can reuse it without depending on any CLI error type.
3. **Number constraints.** `integer`, `min` and `max` apply to `number` entries only. In the seed list, `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` are `integer`, `min: 0`.
4. **Empty strings.** `string` and `enum` values must be non-empty unless the entry sets `allow_empty: true`. This protects e.g. `git.safe_branch` and `git.email`. Arrays may be empty.
5. **`null` on a known key** is a type mismatch (exit `3`) with `hint: use 'config unset' to remove it`. Storing `null`, which [value parsing](command-surface.md#value-parsing) allows, is therefore only possible for an unknown key with `--force`.
6. **`format: regex`.** Each array element is compiled with `new RegExp(p, 'i')`. A failure names the element index and the compile error, e.g. `arcanum: auto-fix-all.ignored_check_patterns[2] is not a valid regex: Unterminated group`.
7. **`--force`.** On an unknown key it stores the parsed value as-is, with no type check. On a known key it bypasses nothing: every check above still runs. The `<agent>` existence warning still prints under `--force`.
8. **Reads never validate.** `get` and `list` show stored values even when they violate the registry, mirroring how skills read them. Detecting such values (e.g. a `doctor` command) is out of scope for epic #767.

### Consumers

The registry drives:

- `config list`: known keys and their descriptions;
- `config setup`: which keys to ask, their types and allowed tiers;
- `--help` key docs;
- the shortcuts, which are thin front-ends over registry entries (see [Shortcuts and Setup](shortcuts-and-setup.md));
- the specs that keep it in sync with arcanum's own reads (see below).

### Keeping it in sync

Context: Node config reads go through `ConfigChain` and `RepoConfig`, mostly via `RepoContext.readConfig(scope, key)` and sometimes directly. Shell reads all go through `config_chain_read <repo> <ns> <key...>` and the `repo_config_*` / `global_config_*` helpers in `arcanum/_lib/`, with a uniform call shape, e.g. `config_chain_read "." "git" "agents.${agent}" "email"`.

#### How arcanum's own code consumes the registry

**Not at runtime in this epic.** Skills keep their hardcoded defaults, e.g. `DEFAULT_MAX_RETRY_COUNT` in `SpawnIssue.js` and `origin/main` in `safe_branch.sh`.

A **defaults drift spec** asserts that each registry `default` equals the default the code actually applies:

- Node defaults are exported as constants and compared.
- Shell defaults are checked by running the helper with no config present.

Making the code read its defaults from the registry is a follow-up outside epic #767: no runtime coupling and no `core` churn now.

#### Enforcing "a new key means a registry entry"

Three layers:

1. **Node test-mode guard.** When `ARCANUM_STRICT_CONFIG_KEYS=1`, which core's spec runner sets, **`ConfigChain#read` and `RepoConfig`'s read** (both on the shared surface) throw on a key that matches no registry entry. The guard sits there rather than in `RepoContext.readConfig` because some code bypasses `RepoContext`: `SafeBranch.js` uses `RepoConfig` directly, and the `auto-new-issue` / `auto-plan-issue` commit commands use `ConfigChain` directly. Any spec that exercises a read of an unregistered key fails. Production behaviour is unchanged.
2. **Shell static scan.** A spec under `core/spec/` scans `*.sh` for `config_chain_read`, `repo_config_read` / `repo_config_write` and `global_config_read` / `global_config_write` calls. It builds the dotted key from `<ns>` and each `<key>` argument, treats a `${var}` segment as a wildcard segment, and fails if the key matches no registry entry. A call whose key cannot be parsed must carry a `# config-key: <key>` annotation on the preceding line, or the spec fails.
3. **Docs checklist.** "Adding a config key means adding a `keys.json` entry" is a checklist item in [Shared State & Configuration Files](../../architecture/shared-state-and-configuration.md) and in the `node` and `scripter` agent docs.

There is no reverse check (registry entries that nothing reads): it would be too noisy with wildcards and migration-only keys.

### Seed keys

This is the **final** list. #777 transcribes it into `keys.json`, adding descriptions, prompts and the validator specs. Tiers and defaults reflect what the runtime actually reads today, from an audit of every `config_chain_read` / `repo_config_*` / `global_config_*` call and every `core/lib` config read. "all" means global, repo and local; "—" means no default.

| Key | Type | Tiers | Default | Notes |
| --- | --- | --- | --- | --- |
| `engine.mode` | enum `shell` / `native` / `docker` | all | `shell` | `config_chain_read` honours the global tier too, not only repo and local |
| `engine.log.location` | string | all | — | Docker engine log mount |
| `git.email` | string | all | — | default agent email or `{agent}` pattern |
| `git.agents.<agent>` | string | all | — | per-agent email |
| `git.safe_branch` | string | **local only** | `origin/main` | `safe_branch.sh` reads only `.claude/state/arcanum-config.json` |
| `git.merge_body_mode` | enum `full` / `empty` / `coauthors` | all | `empty` | both `merge_body.sh` and `MergeBodyResolver` fall back to `empty` |
| `git.omit_model_coauthor` | boolean | all | `false` | |
| `git.remove_coauthors` | array of strings | all | `[]` | emails removed from the coauthors list |
| `next_step.auto.<skill>` | boolean | all | `false` | only JSON `true` enables it |
| `auto-fix-all.ignored_check_patterns` | array of strings, `format: regex` | **repo only** | `[]` | each entry is a case-insensitive regex |
| `auto-fix-all.clear_context` | boolean | local only | `false` | |
| `auto-fix-all.finish_on_empty_queue` | boolean | local only | `false` | |
| `monitor-issues.clear_context` | boolean | local only | `false` | **added together with #776 only**: today it lives in `.claude/state/monitor-issues-config.json`, outside the tier files |
| `plan-issues.max-retry-count` | number, `integer`, `min: 0` | all | `5` | |
| `plan-issues.error-sleep-time` | number, `integer`, `min: 0` | all | `5` | seconds |
| `version` | string, read-only | repo only | — | managed by migrations and `init-claude` |
| `migrations.version` | string, read-only | local only | — | managed by the migrations runner |

Compared with the first draft of this table: `engine.log.location`, `git.omit_model_coauthor` and `git.remove_coauthors` were added; `engine.mode` moved from repo-or-local to all tiers; `git.safe_branch` became local-only; and `git.merge_body_mode`'s default is `empty`. These document existing runtime behaviour; nothing changes behaviour.

`setup` assignments mirror the wizard table in [Shortcuts and Setup](shortcuts-and-setup.md#coverage-and-order) exactly:

| Section | Entries (in `order`) |
| --- | --- |
| `identity` | `git.email`; then `git.agents.<agent>`, with instances from the repo's `.claude/agents/*.md` |
| `engine` | `engine.mode` |
| `git` | `git.safe_branch`, then `git.merge_body_mode` |
| `flow` | `next_step.auto.<skill>`, with `instances: ["enhance-issue", "discuss-issue", "auto-plan-issue"]` |
| `ci` | `auto-fix-all.ignored_check_patterns` |

No other entry carries `setup`.

## Edge cases

- **Dashed segments** (`plan-issues.max-retry-count`, `auto-fix-all.*`) need nothing special: the segment charset covers them.
- **Top-level, un-namespaced keys** (`version`): a single-segment key is valid.
- **`--force` on a known key** still runs every check; it only bypasses the unknown-key and version-skew refusals.
- **A namespace alone** (`config set git '{...}'`) is unknown under the leaf rule, so it needs `--force`.
- **A wildcard value with extra segments** (`git.agents.foo.bar`) is unknown: the segment count does not match.
- **A literal entry overlapping a wildcard** (`next_step.auto.arcanum-update` alongside `next_step.auto.<skill>`) is allowed; the literal entry wins.
- **An invalid registry** is a build-time failure (the specs, plus a validation step in the CLI build), never a runtime path in the installed CLI.

## Backward compatibility

- Skills are unaffected: nothing consumes the registry at runtime in this epic.
- The tier and default corrections in the seed list document existing runtime behaviour; nothing changes behaviour.
- An older CLI meeting newer keys is covered by `--force` plus the existing [version-skew rules](../arcanum-cli.md#version-skew).
- The registry format is internal, not a public contract. The CLI's exit codes and JSON shapes remain the public contract, as decided in [Command Surface](command-surface.md).

## Testing

- **`KeyRegistry` spec**: matching (exact beats wildcard, segment count, charset), and `check` with one case per reason: unknown, read-only, tier, type, enum, empty string, `integer` / `min` / `max`, regex with element index, `null`.
- **Registry validator spec** over the real `keys.json`: unknown fields, duplicate keys, overlapping wildcards, prefix (leaf) violations, a `default` not matching its type, field-scope rules (`integer` / `min` / `max` only on `number`, `allow_empty` only on `string` / `enum`, the `format` vocabulary), and `setup.section` within the canonical set.
- **Sync specs**: the defaults drift spec, the Node strict-keys guard active in every core spec run, and the shell static scan.

## Performance and security

- About 20 entries, inlined in the bundle. Lookups are a linear scan with no I/O; there is nothing to optimise.
- User-supplied `regex` values are only compiled to validate them, never run against input by the CLI. `auto-fix-all.ignored_check_patterns` is a pre-existing ReDoS surface at runtime in `auto-fix-all`; it is noted here and out of scope for this epic.
- The registry is data and is never executed.

## Future work

### Per-key skew granularity

This stays future work, outside epic #767, as the [index](../arcanum-cli.md#version-skew) says. The intended design is recorded here so the follow-up starts from it.

1. **Fields** (not part of `format_version: 1`):
   - `since: "<version>"`: the arcanum version that introduced the key;
   - `moved_in: {"version": "<version>", "from": "<old key>"}`: the version whose migration moved or renamed the key;
   - possibly `removed_in: "<version>"`, on a tombstone entry, so the CLI can explain why an old key is refused.
2. **Intended behaviour.** On a write, if the target tier's pointer is below an entry's `moved_in.version` (the move migration is still pending), the CLI refuses with the version-skew exit `5` and `hint: run /arcanum-migrate first`, bypassable with `--force`. Writes to the old `from` key are treated the same. This upgrades today's "tier behind" warning to a per-key refusal.
3. **Why not now.** No migration so far has moved a key in a way a CLI write could race; the pending-migrations warning covers the common case; and extra fields add authoring burden to every entry.
4. **Cheap to add later.** The registry is bundled, so a CLI only ever reads the registry it was built with. New fields need a validator and code change but **no `format_version` bump**; a bump is needed only if the registry is ever read at runtime from outside the bundle. Since unknown fields are rejected, nobody can add them early by accident.

### Runtime consumption

Making arcanum's own code read its defaults (and possibly validation) from the registry, instead of hardcoded constants checked by the drift spec. See [How arcanum's own code consumes the registry](#how-arcanums-own-code-consumes-the-registry).

## Alternatives considered

- **No registry, with a free-form `set`.** Rejected: typos and wrong types would be accepted silently and only fail later, when a skill reads the key.
- **A registry inside `cli/` only.** Rejected: it would drift from what arcanum actually reads, and arcanum's own code and docs could not use it.
- **JSON Schema.** Rejected: validating it needs `ajv` at runtime, breaking core's zero-dependency rule, and most of what the registry needs (tiers, read-only, `setup`) would live in `x-arcanum-*` extensions anyway.
- **A JS module.** Rejected: unreadable from shell and docs, and adding a key would become a code change.
- **An object keyed by key name.** Rejected: `JSON.parse` silently drops duplicate keys.
- **`core/registry/`.** Rejected: a cleaner data/code split, but it adds a second path to the shared-surface list and the CI filters.
- **`arcanum/_lib/`.** Rejected: owned by `scripter`, so one feature would be split across two agents and the Node side would reach into another agent's folder.
- **A new root-level folder.** Rejected: a new owner decision, roster and Docker changes, for one file.
- **Reading defaults from the registry at runtime now.** Rejected for this epic: runtime coupling and `core` churn; the drift spec gives the same guarantee.
- **An existence check on `<skill>`.** Rejected: the independently installed CLI cannot reliably know arcanum's skill list.
- **A reverse check for unread registry entries.** Rejected: too noisy with wildcards and migration-only keys.

## Open points

None. Every point this part owns is decided above; the implementation is #777's.
