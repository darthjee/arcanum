# Issue: Global cross-project local arcanum config

## Description

Arcanum currently has two config layers, both scoped to a single repo:

- `.claude/configuration/arcanum-repo-config.json` — committed, shared, repo-wide config.
- `.claude/state/arcanum-config.json` — gitignored, per-checkout local state (e.g. `git.safe_branch`, and `git.email` per issue #156).

Neither layer survives outside the repo it lives in. This issue adds a third, outermost config layer — global, cross-project, scoped to the active Claude Code account/profile — consulted only when neither of the two existing per-repo layers has a value. It was raised as a related but explicitly out-of-scope idea while discussing #156, and is tracked here as its own follow-up.

## Problem

A user working across many projects on the same machine — or the same account across machines, if synced — currently has no way to set a personal default that arcanum picks up automatically in every repo, without re-configuring `.claude/state/arcanum-config.json` per clone. Concretely: #156's `git.email` migration (`arcanum/migrations/repos/0.14.0/002.sh`) prompts for a commit-author email pattern separately in every repo, since it only writes to that repo's own local state — there's no way to answer it once and have it apply everywhere.

## Expected Behavior

- A new global config file, resolved from `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (falling back to Claude Code's own documented default when `CLAUDE_CONFIG_DIR` is unset), holds cross-project defaults — scoped per active Claude Code account/profile, not literally OS-wide. A user running multiple accounts (e.g. `claude-d`, `claude-f`) gets one arcanum global config per account, automatically.
- Config resolution follows `local repo state -> repo config -> global user config -> hardcoded default`, mirroring git's own `--local` > `--global` > `--system` precedence — a repo's own explicit value always wins over the global default.
- `git.email` becomes the first concrete key wired into this chain, via `agent_email_get`.
- A new, future migration (`applies_to: "local"`, `type: "script"`) prompts for a global `git.email` default exactly once across all of a user's repos on that machine/account — it checks local state and repo config first (so it never re-asks a question `002.sh` already answered in that repo), and only prompts (writing to the new global file) when nothing is configured anywhere yet.

## Solution

### Global config file location & format

Resolved relative to whichever Claude Code profile invoked the skill, not a fixed `$HOME` path: `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` — the same env var Claude Code itself uses to relocate its own config directory for multi-account setups, falling back to Claude Code's own documented default (`~/.claude`) when unset.

Bare filename, no subfolder — reuses the exact same base name as the repo-local file (`.claude/state/arcanum-config.json` -> `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`). No legacy-file split to make room for at this layer. The lock file lives alongside it (`arcanum-config.json.lock`), same convention as every other locked config file in the codebase.

Format: same namespaced JSON shape as the two existing files, no `version`/legacy baggage:
```json
{
  "git": { "email": "you+{agent}@example.com" }
}
```

### Resolution chain integration

**New dedicated reader/writer, not an extension of `repo_config_read`/`repo_config_write`.** `repo_config_read` is shared by callers (e.g. `auto-fix-all`'s `ignored_check_patterns`, `safe_branch.sh`) that must *not* pick up a global fallback unconditionally — only specific keys (like `git.email`) are wired into it for now. Baking a global fallback into `repo_config_read` itself would make it apply everywhere (opt-out instead of opt-in). Also, the global file lives outside any repo, which doesn't fit `repo_config_read`'s two repo-relative file-path args.

So: a new `arcanum/_lib/global_config.sh` with `global_config_read <namespace> <key>` and `global_config_write <namespace> <key> <json_value>` (locked, mirroring `repo_config_write`'s atomic write). For signature consistency with every other arcanum script's `repo_path`-first-arg convention, both still take a leading arg even though it's unused/ignored for a file resolved from `CLAUDE_CONFIG_DIR`/`$HOME` instead.

**Centralized chain reader.** Rather than every caller manually re-chaining `repo_config_read` (local) -> `repo_config_read` (repo) -> `global_config_read` by hand, add one composing function that owns the full lookup — `config_chain_read <repo_path> <namespace> <key>` in a new `arcanum/_lib/config_chain.sh`, sourcing both `repo_config.sh` and `global_config.sh` rather than adding this logic to either. Returns the first present value across all three tiers, empty if none — callers still apply their own hardcoded default on top. `agent_email_get` becomes this function's first caller.

**Resolution order: `local -> repo -> global -> hardcoded default`.** Repo config is a committed, team-visible, deliberately-chosen setting for that project, so it should win over a user's own roaming personal default — the global layer only applies when the project itself has no opinion. This mirrors git's own precedence (`--local` > `--global` > `--system`) closely.

### Migration integration

A *new* migration (future version, `applies_to: "local"`, `type: "script"`) mirrors `0.14.0/002.sh`'s existing `[Y]es/[T]ype/[S]kip` `/dev/tty` idiom, but targets `global_config_write` instead of `repo_config_write`, and reuses `002.sh`'s `_guess_default` unchanged (derives `<local>+{agent}@<domain>` from `git config user.email`). No new migration scope is needed — `local` (run once per checkout) is reused as-is; the *action script's* own idempotency (checking whether the global file already has the key) is what makes the "ask once, ever" behavior work, not the migration ledger.

Since `002.sh` is already released and can't be retroactively changed, this new migration's `run` step checks the existing chain first (local state, then repo config) — if either already has a value (e.g. set by `002.sh`), it skips silently, since that repo is already satisfied. It only prompts (and writes to the global file) when nothing is configured anywhere yet. Net effect: repos that already answered `002.sh`'s prompt are never asked again; repos that have been skipping it get asked exactly once, ever, the first time this migration reaches any of the user's repos on that machine — every other repo's copy of the same migration then finds the global value already set and no-ops.

### Which keys qualify

The resolution order itself already protects repo-specific correctness — a repo's own explicit value always wins, so the global layer only ever applies when nothing more specific is set anywhere. There's no need to gatekeep *which* keys are allowed to have a global default based on "is this repo-specific or user-specific" — almost every existing namespaced key (`auto-fix-all.ignored_check_patterns`, `auto-fix-all.clear_context`/`finish_on_empty_queue`, `plan-issues.error-sleep-type`/`max-retry-count`, `git.safe_branch`, `git.email`) is a legitimate candidate.

The real exception is **per-checkout progress pointers**: `.claude/state/arcanum-config.json`'s `migrations.version` (and, analogously, the committed `.version` pointer in `arcanum-repo-config.json`) exist specifically to answer "how far has *this* checkout/repo advanced" — there's no sensible global default for a per-checkout counter. Those categorically never participate in the global-config chain.

This issue only wires up `git.email` as the one concrete, working example — the rest stay open for later, feature-by-feature adoption of `config_chain_read`.

### Edge cases

- **`null` vs. absent must fall through, not short-circuit.** `repo_config_read`'s presence check treats an explicit `null` as "present," but `agent_email_get` today deliberately treats `null` the same as absent so it still falls through to the next tier. `config_chain_read` must bake in this same null-aware skip logic at each tier.
- **Malformed/corrupt global JSON** — stays silent-and-empty, same as `repo_config_read`'s existing behavior for a malformed local/repo file today (no new warning behavior introduced for this tier).
- **Missing/unresolvable `$HOME`, or `CLAUDE_CONFIG_DIR` pointing at a nonexistent directory** — `global_config_read`/`write` should degrade to "no global config available" rather than hard-erroring; a broken global tier must never take down the local/repo tiers underneath it in `config_chain_read`.
- **Missing parent directory / missing file on first write** — handled the same way `repo_config_write` already does (`mkdir -p`, create-if-absent).
- **Concurrent writes across repos** — covered by locking `global_config_write` the same way as `repo_config_write`.
- **Interactive double-prompt race** (low severity, accepted): two people-driven migration sessions running at the exact same moment in two different repos, neither having written the global value yet, could both prompt the user — the second answer just overwrites the first via the normal locked write, harmless. Automated (non-TTY) runs never hit this.
- **Empty string vs. `null`.** Only `null` falls through to the next tier; an explicit empty string (`""`) is treated as a real value and stops the chain there.
- **File permissions.** The global file is created with normal default permissions (`644`), same as every other config file in this codebase — no extra restriction, since it already lives under the user's own home directory.

### Backward compatibility

Purely additive — nothing changes behavior for anyone not opting in:

- `agent_email_get` (the only caller rewired to `config_chain_read`) only produces a different result than today in the one case where both local state and repo config are already absent — previously that fell straight to the hardcoded model-email default; now it checks the new global tier first. Repos that already have `git.email` set locally or in repo config resolve identically to today.
- No file-format compatibility concern — the global file is brand new, no existing shape in the wild to be compatible with.
- Gated by updating arcanum itself — repos still on an older arcanum version simply don't participate until they run `/arcanum-migrate` or `/arcanum-update`.
- `002.sh` (already released) stays untouched — no retroactive behavior change for repos that already ran it.
- Every other `repo_config_read` call site is untouched — only `agent_email_get` is rewired.

### Testing strategy

No dedicated regression script required for this issue — matches this repo's existing default (manual verification), per `docs/agents/todo.md`'s note that there's no shared test framework for arcanum's shell scripts yet.

### Documentation

Document the new config layer in `docs/agents/architecture.md` and `docs/agents/folder-structure.md`, making the full resolution order explicit, plus a new dedicated end-user guide (e.g. `docs/guides/arcanum-global-config.md`) mirroring `docs/guides/arcanum-repo-config.md`'s style. (See #167, spun out separately, for splitting `architecture.md` itself into per-topic files — independent of this issue and can land in either order.)

## Benefits

- Users no longer have to re-answer the same per-repo migration prompt (e.g. #156's `git.email` pattern) in every project they work in.
- Establishes a general, reusable pattern (`config_chain_read`) that other features can opt into later for their own cross-project defaults (CI-check ignore patterns, retry/backoff tuning, etc.) without changing behavior for anyone who doesn't opt in.
- Correctly scoped per Claude Code account/profile (via `CLAUDE_CONFIG_DIR`), so users running multiple accounts on the same machine get independent global defaults automatically, with no arcanum-specific profile-detection logic needed.
