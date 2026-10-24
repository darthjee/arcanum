# Shared State & Configuration Files

Skills store runtime state and configuration under `.claude/`:

| File | Purpose | Schema |
| --- | --- | --- |
| `.claude/state/auto-fix-all-queue.json` | Queue of issue IDs to be processed by `auto-fix-all`. The first element is always the currently in-progress entry. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/auto-fix-all-queue.lock` | Lock file used during `push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/issue-<id>.json` | Unified per-issue state file used by `auto-fix-issue`, `monitor-issues`, and `auto-monitor-pr`. `auto-fix-issue` writes the `step` field after each completed step so the skill can resume on re-invocation. `monitor-issues` stores per-issue `updated_at` and `tags` here (replacing its own `issues.json` entry). `auto-monitor-pr` stores `pr_comments` and `last_comment_time` here when called with an issue id (replacing the legacy per-PR file). | `{"step": "<step_name>", "updated_at": "<ISO8601>", "tags": ["<tag>", ...], "pr_comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "state": "fetched\|processing\|addressed", "emojis": ["<:emoji_name:>"]}], "last_comment_time": "<ISO8601>"}` — all fields optional |
| `.claude/state/auto-monitor-pr-<pr_number>-comments.json` | **Deprecated.** Legacy per-PR comments file used by `auto-monitor-pr` when no issue id is supplied. New invocations should pass an issue id and use `.claude/state/issue-<id>.json` instead. | `{"comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open"\|"addressed"}], "last_comment_time": "<ISO8601>"}` |
| `.claude/configuration/arcanum-repo-config.json` | Committed, shared, arcanum-wide configuration — each feature keeps its own namespaced key so features never collide. Holds `auto-fix-all`'s CI-ignore config (which check names are ignored when deciding pass/fail) plus, at the top level (not namespaced), `.version` — this repo's recorded arcanum version, stamped by `init-claude` and read by `arcanum/migrations/run.sh` (see [Per-Repo Migrations](per-repo-migrations.md)). Also holds `engine.mode` — the committed, repo-wide default for which entrypoint implementation runs, `"shell"` (absent-key default) \| `"native"` \| `"docker"`; see [Script Engine](script-engine.md). Under `"docker"`, docker-ready commands run in a per-call container that sees this repo, its `.claude/state/` and `.claude/configuration/` through a read-write mount at the same path, so host and container processes share the same state files and locks (see [Docker Engine → Shared state and locks](docker-engine.md#shared-state-and-locks)). Also holds `next_step.auto.<skill>` — the committed, repo-wide opt-in to auto-continue a skill's next-step offer — and its companion `next_step.clear.<skill>` (see "The `next_step` namespace" below). Superseded `.claude/configuration/auto-fix-all.json`. `auto-fix-all`'s `ignored_check_patterns` key no longer falls back to that legacy file — `repo_config_seed` migrations (`arcanum/migrations/repos/0.9.3/001.sh`, `arcanum/migrations/repos/0.18.0/001.sh`) copy it forward instead. `arcanum/_lib/repo_config.sh` implements the optional legacy-file fallback (`repo_config_read`, still used by other keys' call sites) plus the lock-protected write/seed helpers (`repo_config_write`, `repo_config_seed`) once, for every reader/writer to share — `auto-fix-all/scripts/config.sh` and `auto-fix-all/scripts/wait_ci.sh` both route through it instead of hardcoding the legacy path independently. | `{"version": "<semver>", "auto-fix-all": {"ignored_check_patterns": ["<substring>", ...]}, "engine": {"mode": "shell"\|"native"\|"docker"}, "next_step": {"auto": {"<skill>": true\|false}, "clear": {"<skill>": true\|false}}}` |
| `.claude/state/arcanum-config.json` | Per-checkout, gitignored, arcanum-wide run-time state — same namespacing story as `arcanum-repo-config.json` above, but for personal/frequently-toggled state instead of committed settings. Holds `auto-fix-all`'s `clear_context` toggle (flipped by `/toggle-clear-context`) and `finish_on_empty_queue` toggle (opts a run into stopping cleanly once its queue drains instead of blocking forever on `queue.sh wait-next`) under the `auto-fix-all` key — both writable via `init-claude`'s `setup_auto_fix_all_settings.md` step, `finish_on_empty_queue` has no standalone toggle skill. Also holds `monitor-issues.clear_context` (flipped by `/toggle-monitor-clear-context`) under the `monitor-issues` key — `monitor-issues/scripts/config.sh` routes `clear_context` reads/writes here via `arcanum/_lib/repo_config.sh`, with no legacy-file fallback (the per-repo local migration `arcanum/migrations/repos/2.2.0/001.sh` copies an existing value forward from the superseded `.claude/state/monitor-issues-config.json`); every other `monitor-issues` key goes under `.monitor-issues.<key>` in `.claude/configuration/arcanum-repo-config.json`, falling back to (and seeded from) the legacy `.claude/configuration/monitor-issues.json`. Writes lock `.claude/state/arcanum-config.json.lock`, the same lock `repo_config_write` uses everywhere. Also holds `git.safe_branch` — the ref (default `origin/main` when absent) that `arcanum/_lib/safe_branch.sh` checks out via `enhance-issue`/`discuss-issue`/`arcanum-split-issue` (see [Branch Bootstrap and Merge Conflicts](branch-bootstrap-and-merge-conflicts.md)); seeded by the per-repo migration `arcanum/migrations/repos/0.13.0/001.sh`. Also holds `engine.mode` — this clone's local, gitignored override of the committed repo-config default above, same namespace/key shape, highest-precedence tier in the chain; see [Script Engine](script-engine.md). Also holds `next_step.auto.<skill>` and `next_step.clear.<skill>` — this clone's personal overrides of the repo-config values (see "The `next_step` namespace" below). Also holds, at the top level (not namespaced, matching the committed file's own top-level `.version`), `.migrations.version` — this clone's local-only per-repo-migrations pointer, stamped by `init-claude` and read/advanced by `arcanum/migrations/run.sh`'s runner chain (see [Per-Repo Migrations](per-repo-migrations.md) and `docs/guides/arcanum-repo-version.md`). Superseded `.claude/state/auto-fix-all-config.json`. `clear_context`/`finish_on_empty_queue` no longer fall back to that legacy file — `repo_config_seed` migrations (`arcanum/migrations/repos/0.9.3/001.sh`, `arcanum/migrations/repos/0.18.0/002.sh`) copy them forward instead. `auto-fix-all/scripts/config.sh` routes both `auto-fix-all` keys' reads/writes here (via `arcanum/_lib/repo_config.sh`); every other key still goes to the configuration file pair above. | `{"auto-fix-all": {"clear_context": true\|false, "finish_on_empty_queue": true\|false}, "monitor-issues": {"clear_context": true\|false}, "git": {"safe_branch": "origin/main"}, "engine": {"mode": "shell"\|"native"\|"docker"}, "next_step": {"auto": {"<skill>": true\|false}, "clear": {"<skill>": true\|false}}, "migrations": {"version": "<semver>"}}` |
| `.claude/state/monitor-issues-config.json` | **Legacy, obsolete.** Formerly the per-checkout, gitignored home of `monitor-issues`' `clear_context` toggle. No longer read or written: the toggle now lives at `.monitor-issues.clear_context` in `.claude/state/arcanum-config.json` (see above), and the non-skippable local migration `arcanum/migrations/repos/2.2.0/001.sh` seeds its value forward. The file is left in place (not deleted), as is its old `.claude/state/monitor-issues-config.lock`, which is no longer used either. | `{"clear_context": true\|false}` |
| `.claude/state/monitor-issues-rewrite-queue.json` | Queue of issue IDs awaiting a `created` rewrite, drained by `auto-rewrite-issue`. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/monitor-issues-rewrite-queue.lock` | Lock file used during `rewrite_queue.sh push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/init-claude-config.json` | Created by `init-claude`'s `setup_labels.md` step, in the **target repo being initialized** (not Arcanum's own state, unlike the other rows in this table). Stores the label/color table `init-claude/scripts/sync_labels.sh` renders and syncs to GitHub, so the script needs no config-path CLI argument to know the current table (it does require `repo_path` as its leading argument, per [Repo Path Threading](repo-path-threading.md)). Auto-populated with the standard default labels (see `DEFAULT_LABEL_PAIRS`; including `Fetched`, backing the `fetched` issue tag) by `init-claude/scripts/lib/label_config.sh`'s `label_config_ensure_defaults` function whenever the file is missing or its `labels` array is empty; `init-claude/scripts/write_label_config.sh <replace\|remove\|add> <config_path> ...` mutates it during a user-driven refinement loop — `replace` overwrites the whole `labels` array, `remove` deletes named labels, `add` upserts `<name>:<color>` pairs. | `{"labels": [{"name": "<label name>", "color": "<hex color, no leading '#'>"}, ...]}` |
| `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | **Not inside the target repo at all** — global, cross-project, scoped to the active Claude Code account/profile (the same env var Claude Code itself uses to relocate its own config directory, so a user running multiple accounts on one machine gets one arcanum global config per account automatically). The third and outermost tier in the config resolution chain, below the two repo-scoped files above it — consulted only when neither a repo's local state nor its repo config has a value for a given key. Reuses the exact same bare filename as `.claude/state/arcanum-config.json`, with the lock file alongside it (`arcanum-config.json.lock`). Holds `git.email`, seeded (at most once, ever, across every repo on the machine/account) by the per-repo migration `arcanum/migrations/repos/0.15.0/001.sh` — see "The global config tier" below. Can also hold `next_step.auto.<skill>` and `next_step.clear.<skill>`, personal defaults for every repo (see "The `next_step` namespace" below). Can also hold `engine.mode`, a personal default for every repo, read by `config_chain_read` below both repo-scoped tiers (see [Script Engine](script-engine.md)). Under `engine.mode=docker`, only this one file of `CLAUDE_CONFIG_DIR` is mounted into the container, read-only, for commands that declare `--needs=global-config`; no container call ever writes it (see [Docker Engine → Global arcanum config](docker-engine.md#global-arcanum-config)). | `{"git": {"email": "you+{agent}@example.com"}, "engine": {"mode": "shell"\|"native"\|"docker"}, "next_step": {"auto": {"<skill>": true\|false}, "clear": {"<skill>": true\|false}}}` |

Never write to these files directly — always use the dedicated scripts (e.g. `queue.sh push`, `queue.sh pop`) that handle locking and atomicity.

## The key registry

`shared/lib/config/keys.json` is the source of truth for every arcanum config key: its type, the tiers it may live in, its default, and its `setup` wizard entry. `shared/lib/config/KeyRegistry.js` loads it, matches dotted keys against it and validates values. Both live in the [Shared Lib](shared-lib.md). The full key list is the file itself; this section describes its format and rules.

### Entry shape

The registry is a plain JSON table, checked by a small hand-written validator (`validateRegistry` in `KeyRegistry.js`):

- **Top level:** `{"format_version": 1, "keys": [ ... ]}`. `KeyRegistry` refuses a registry whose `format_version` is higher than the one it knows (`FORMAT_VERSION`, currently `1`).
- **Entries are an array**, not an object keyed by name, so a duplicate `key` is rejected instead of being dropped silently by `JSON.parse`.
- **Required fields:** `key` (dotted, may contain [wildcard segments](#wildcard-matching)), `type`, `tiers` (a non-empty, non-repeating subset of `global`, `repo`, `local`) and a non-empty `description`.
- **Closed type vocabulary:** `string`, `boolean`, `number`; `enum`, which requires `values` (a non-empty array of strings); and `array`, which requires `items` (one of `string`, `boolean`, `number`). There is no object type: every key is a leaf.
- **`format`** (optional): a closed vocabulary of extra checks, currently only `regex`, allowed on a `string` or an array of strings. Each value (or array element) must compile with `new RegExp(v, 'i')`. New formats are added in code, never as free-form patterns in the registry.
- **`read_only`** (optional): boolean, default `false`.
- **`default`** (optional): absent means no default. When present it must pass the entry's own value checks. It feeds the `default` field the CLI reports for a key.
- **Number constraints** (optional, `number` only): `integer: true`, `min`, `max` (finite, with `min <= max`).
- **`allow_empty`** (optional, `string` and `enum` only): see [Validation](#validation).
- **`setup`** (optional): `{section, order, prompt, instances?}`, for the keys the [`config setup` wizard](arcanum-cli.md#setup-wizard) asks. The wizard asks exactly the entries that carry it, ordered by `section` in the canonical order `identity`, `engine`, `git`, `flow`, `ci` (`SETUP_SECTIONS`), then by the integer `order`. `prompt` is a required non-empty string, but the wizard currently shows the entry's `description` as the question, not `prompt`. `instances` is only allowed on a wildcard key and lists the concrete names the wizard asks about (e.g. `next_step.auto.<skill>` → `enhance-issue`, `discuss-issue`, `auto-plan-issue`). It is wizard-only: it never restricts which values are valid. `git.agents.<agent>` has no `instances`, because the wizard takes them from the target repo's `.claude/agents/*.md`. Adding a key to the wizard is a registry edit, not CLI code.
- **Unknown fields are rejected**, at the top level, on an entry and inside `setup`, so a typo such as `"teirs"` fails the specs.

Example:

```json
{
  "format_version": 1,
  "keys": [
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

### Location

- `keys.json` and `KeyRegistry.js` sit side by side in `shared/lib/config/`, with their specs (`keys_spec.js`, `KeyRegistry_spec.js`) under `shared/spec/config/`. Both are owned by `shared`.
- **The `keys.json` exception:** any agent may add, edit or remove an entry for a config key that its own change introduces, so adding a key never needs a separate `shared` dispatch (see [Shared Lib → Ownership](shared-lib.md#ownership)).
- `KeyRegistry.js` loads the file with a static JSON import (`import registryData from './keys.json' with { type: 'json' }`) and never reads the filesystem. `esbuild` inlines the import, so the bundled `arcanum-cli` carries the registry it was built with and never reads one from an arcanum install. Inside `core/` the same import runs unbundled.
- Being under `shared/lib/`, the registry is covered by the shared lib's existing guardrails: the import-boundary lint rule, the CLI build's metafile check and the always-on `cli` and `shared` CI jobs. It also ships with `shared/lib/` in the release zip and the runtime image, so shell scripts could read it with `jq`.
- `architect` owns the docs rule that a new config key means a registry entry (see [Keeping it in sync](#keeping-it-in-sync)).

### Wildcard matching

1. **Syntax.** A segment written `<name>` matches exactly one dotted segment. Whole segments only: no `*`, no partial segments, no multi-segment wildcards. The label inside the brackets (`<agent>`, `<skill>`) is for docs and `--help` only.
2. **Concrete segments** match `[A-Za-z0-9_-]+`; dots are always separators. The segment count must match, so `git.agents.foo.bar` matches nothing.
3. **Precedence.** A fully literal entry always beats a wildcard entry, so a specific override such as `next_step.auto.arcanum-update` may sit next to `next_step.auto.<skill>`. The validator rejects two wildcard entries that could match the same concrete key, so precedence never needs more than "literal beats wildcard".
4. **Leaf integrity.** The validator rejects an entry whose key is a prefix of another's (e.g. `git.agents` next to `git.agents.<agent>`). A whole namespace or subtree is therefore never a known key.
5. **No existence check on wildcard values.** Any well-formed `<skill>` or `<agent>` name is accepted. The CLI is installed independently of arcanum and cannot reliably know the skill list.
6. **Patterns.** `lookup(key)` matches a concrete key. `lookupPattern(pattern)` matches a pattern that itself has `<name>` segments, as the shell static scan builds them; a wildcard segment in the pattern only matches a wildcard segment of an entry.

### Validation

`KeyRegistry#check(op, key, tier, value)` validates a `set` or `unset` and returns a structured result instead of throwing: `{ok: true}`, or `{ok: false, reason, ...details}` (e.g. `{reason: 'type', expected, got}`). The CLI maps it to its own messages and exit code `3` (see [Arcanum CLI → Error messages](arcanum-cli.md#error-messages)); arcanum's own code can reuse it with no CLI error type.

1. **Fixed order, first failure wins:** `unknown` → `read_only` → `tier` → the value checks. `unset` stops after the tier check.
2. **Value checks**, in order: `null` → `type` → `enum` → `empty` → `integer` / `min` / `max` → `format`. The same checks validate an entry's `default`.
3. **`null` on a known key** is refused with the hint `use 'config unset' to remove it`.
4. **Empty strings.** `string` and `enum` values must be non-empty unless the entry sets `allow_empty: true`. Arrays may be empty.
5. **Numbers** must be finite; an array element of the wrong type fails `type` with its `index`.
6. **`format: regex`.** Each element is compiled with `new RegExp(p, 'i')`, only to validate it. A failure carries the element `index` (for an array) and the compile error with V8's prefix stripped.
7. **Reads never validate.** The CLI's reads show stored values even when they violate the registry, as skills read them.

How `--force` interacts with these checks is part of the CLI's contract, in [Arcanum CLI → `--force` scope](arcanum-cli.md#--force-scope): on an unknown key it stores the parsed value with no check, and on a known key it bypasses none of the checks above.

### Consumers

- The CLI's `config` command: the known-key list in `config --help` and `config list`, write validation, the shortcuts' defaults and the `setup` wizard's questions and order.
- The specs that keep the registry in sync with arcanum's own reads (below).

Skills never read it at runtime, so they behave as before and keep their hardcoded defaults (e.g. `DEFAULT_MAX_RETRY_COUNT` in `SpawnIssue.js`, `origin/main` in `safe_branch.sh`).

### Keeping it in sync

Three checks keep the registry equal to what arcanum actually reads:

1. **Defaults drift spec** (`core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`): every registry `default` equals the default the code applies. Node defaults are compared through exported constants (e.g. `DEFAULT_MERGE_BODY_MODE`, `DEFAULT_SAFE_BRANCH`) or the reader's result with no config present; shell defaults by running the helper against a temp repo with no config files.
2. **Strict-keys read guard.** When `ARCANUM_STRICT_CONFIG_KEYS=1`, `ConfigChain#read` / `#readWithSource` and `RepoConfig`'s reads throw a plain `Error` naming any key that matches no registry entry (`assertRegisteredConfigKey` in `KeyRegistry.js`). The guard sits there, not in `RepoContext.readConfig`, because some code reads through `RepoConfig` or `ConfigChain` directly. Core's spec runner sets the flag (`core/spec/support/strictConfigKeys.js`), so every core spec, and every child process it spawns, exercises it. Production never sets it.
3. **Shell static scan** (`core/spec/lib/utils/config/ShellConfigKeyScan_spec.js`): scans `*.sh` for `config_chain_read`, `repo_config_read` / `repo_config_write` and `global_config_read` / `global_config_write` calls, builds the dotted key from the namespace and key arguments (a `${var}` segment becomes a wildcard segment), and fails if it matches no entry. A call whose key cannot be built needs a `# config-key: <dotted.key>` annotation on the line above.

There is no reverse check for registry entries that nothing reads: it would be too noisy with wildcards and migration-only keys. An invalid registry fails the `keys_spec.js` validator spec, so it never reaches a build or a runtime path.

**Checklist — adding a config key:**

- [ ] Add a `shared/lib/config/keys.json` entry for it (type, tiers, default, and `setup` if the wizard asks for it).
- [ ] If a shell call reads or writes it through a key the static scan can't build (a variable used as the whole namespace or the whole key argument), put a `# config-key: <dotted.key>` annotation on the line directly above the call.

### Future work

- **Per-key skew granularity.** Optional `since: "<version>"`, `moved_in: {"version", "from"}` and possibly a tombstone `removed_in` field would let the CLI refuse a write (exit `5`, bypassable with `--force`) when the target tier is below the version whose migration moved the key, instead of today's tier-level skew rule. It is not done yet because no migration has moved a key in a way a CLI write could race, and every entry would carry the extra authoring burden. It needs no `format_version` bump: the CLI only ever reads the registry bundled into it, and unknown fields are rejected, so nobody can add the fields early by accident. A bump is only needed if the registry is ever read at runtime from outside the bundle.
- **Runtime consumption.** Arcanum's own code could read its defaults (and possibly validation) from the registry instead of hardcoded constants checked by the drift spec.

### Alternatives considered

- **No registry, with a free-form `set`.** Rejected: typos and wrong types would only fail later, when a skill reads the key.
- **A registry inside `cli/` only.** Rejected: it would drift from what arcanum reads, and arcanum could not use it.
- **JSON Schema.** Rejected: it needs `ajv` at runtime, breaking the zero-dependency rule, and tiers, read-only and `setup` would be extensions anyway.
- **A JS module, or an object keyed by key name.** Rejected: a module is unreadable from shell and makes adding a key a code change; an object silently drops duplicate keys.
- **Another location** (`core/registry/`, `arcanum/_lib/`, a new root folder). Rejected: each adds a second guarded path, splits one feature across owners, or needs a new owner for one file.
- **Reading defaults from the registry at runtime now.** Rejected: runtime coupling and `core` churn, while the drift spec gives the same guarantee.
- **An existence check on `<skill>`, or a reverse check for unread entries.** Rejected: the independently installed CLI cannot know arcanum's skill list, and the reverse check is too noisy.

## The global config tier

`agent_email_get` (`arcanum/_lib/agent_email.sh`) used to manually chain two `repo_config_read` calls — local state, then repo config — before falling back to the calling script's own model-email default. That two-tier chain is now generalized: `arcanum/_lib/config_chain.sh`'s `config_chain_read <repo_path> <namespace> <key1> [<key2> ...]` composes all three tiers in order (local state -> repo config -> global config); within each tier it tries every given key in order, returning the first present-and-non-null value found, and only advances to the next tier once none of the keys resolved in the current one — mirroring git's own `--local` > `--global` > `--system` precedence — a repo's own explicit value always wins over the user's roaming personal default. A single key is just the degenerate case of this loop, so existing single-key callers are unaffected. `arcanum/_lib/global_config.sh` provides the outermost tier's own reader/writer, `global_config_read`/`global_config_write` (locked, atomic-write, mirroring `repo_config_write`'s shape) — a dedicated new file rather than an extension of `repo_config_read`/`repo_config_write`, since most existing `repo_config_read` callers (e.g. `auto-fix-all`'s `ignored_check_patterns`, `safe_branch.sh`) must *not* pick up a global fallback unconditionally; only keys explicitly wired into `config_chain_read` participate. Both `global_config_read`/`global_config_write` still take a leading `repo_path` argument for signature consistency with every other arcanum script, even though it's unused/ignored — the global file's location never depends on which repo is calling. `git.agents.<agent_name>` and `git.email` (tried in that order, per tier, by `agent_email_get`) and `next_step.auto.<skill>` (read by `arcanum/_lib/next_step_prompt.sh`'s `--auto-key`) are the keys wired into this chain; every other `repo_config_read` call site is untouched. Both `repo_config_read` and `global_config_read` additionally accept a dotted-path `key` (e.g. `agents.architect`), resolved via `jq getpath` under the given namespace instead of direct single-segment indexing — flat (no-dot) keys keep behaving exactly as before. The writers match: `repo_config_write`, `global_config_write` and the native `RepoConfigWriter` treat a dotted `key` as a nested path under the namespace (`setpath`), creating any missing intermediate objects and keeping sibling keys, so `next_step` / `auto.enhance-issue` writes `{"next_step": {"auto": {"enhance-issue": ...}}}`. A malformed/corrupt global file, or an unresolvable `$HOME`/`CLAUDE_CONFIG_DIR`, degrades silently to "no value" at that tier — same as `repo_config_read`'s existing behavior for a malformed local/repo file — rather than taking down the tiers underneath it. See `docs/guides/arcanum-global-config.md` for the end-user-facing explanation.

## The `next_step` namespace

`next_step.auto.<skill>` is a boolean, default `false`, that opts a skill's next-step offer into continuing automatically instead of prompting. `arcanum/_lib/next_step_prompt.sh --auto-key <skill>` reads it through `config_chain_read <repo_path> next_step auto.<skill>`, so it resolves across all three tiers (local state → repo config → global config). Only the JSON boolean `true` enables it: absent, `null`, `false`, the string `"true"`, or any other value counts as `false`. See [Skill Finish](skill-finish.md#auto-next) for the script contract.

| Key | Offer it skips |
| --- | --- |
| `next_step.auto.enhance-issue` | `/discuss-issue <id>` after `enhance-issue` |
| `next_step.auto.discuss-issue` | `/auto-plan-issue <id>` (discuss-issue's first offer) |
| `next_step.auto.auto-plan-issue` | `/loop /auto-resolve-issue <id>` once a plan exists (`auto-plan-issue`, discuss-issue's second offer, `plan-issue`) |

Every skill in the table passes `--auto-key` for its key, as listed in the [Next-step map](skill-finish.md#next-step-map), which also covers the Epic rule, chained versus nested runs, branch safety and `/loop` chaining.

**Enabling.** There are two ways to set the keys besides editing a config file by hand:

- **init-claude**'s `setup_auto_next.md` step shows the three keys in one review-and-confirm table and writes the changed rows to **repo config** (committed, shared by every contributor), through the native-only `init-claude/scripts/set_next_step_auto.sh <repo_path> <skill> <true|false>` (`init-claude-set-next-step-auto`).
- **`/arcanum-migrate`** offers three opt-in, skippable migrations shipped in 2.0.0, one per tier: `arcanum/migrations/repos/2.0.0/001.sh` (`applies_to: local`, local state), `002.sh` (`applies_to: repo`, repo config, with a warning that the value will be committed) and `003.sh` (`applies_to: global`, global config). Each prompts once per key on `/dev/tty` with `[Y]es/[N]o/[S]kip`: `[Y]es` writes `true`, `[N]o` writes an explicit `false`, and `[S]kip` writes nothing. Because the chain stops at the first tier holding a value, an explicit `false` shadows a `true` in a lower-precedence tier, and the prompt says so. With no TTY, a migration writes nothing.

Run `/arcanum-check-config next_step.auto.<skill>` to see which tier a value resolves from.

**Clear keys.** `next_step.clear.<skill>` (same three skills, same 3-tier chain, boolean-strict, default `false`) asks for the conversation context to be cleared at an automatic hop. It only does something when the matching `next_step.auto.<skill>` is `true`: `next_step_prompt.sh --auto-key <skill>` reads it only when auto fires, and then prints `CLEAR=true` after `AUTO=true` (see [Skill Finish](skill-finish.md#auto-next)). init-claude's `setup_auto_next.md` shows it as a `Clear` column in the same table and writes edited cells to **repo config** through the native-only `init-claude/scripts/set_next_step_clear.sh <repo_path> <skill> <true|false>` (`init-claude-set-next-step-clear`, which prints `NEXT_STEP_CLEAR=<skill>=<value>`; it shares a base class with `init-claude-set-next-step-auto`). No `/arcanum-migrate` migration sets the clear keys yet. Run `/arcanum-check-config next_step.clear.<skill>` to see which tier a value resolves from.

To see where a config value comes from, run `/arcanum-check-config <namespace.key>` (e.g. `/arcanum-check-config git.authors`). It prints, as JSON, what each tier (local → repo → global) holds for the key, including shadowed tiers, plus the final value and its source tier. Code-level defaults are not reported.
