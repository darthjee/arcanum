# Plan: Global cross-project local arcanum config

Issue: [160-global-cross-project-local-arcanum-config.md](../../issues/160-global-cross-project-local-arcanum-config.md)

## Overview

Add a third, outermost config-fallback tier to arcanum: a global file at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`, scoped per active Claude Code account/profile, consulted only when a repo's own local state and repo config both have nothing to say for a given key. Ship a new `global_config.sh` library, a composing `config_chain_read` helper, wire `git.email` into it via `agent_email_get`, and add a new local-scoped migration that lets a user set their global `git.email` default at most once across every repo on that machine/account.

No agent split: this issue's work lives entirely in `arcanum/_lib/`, `arcanum/migrations/`, and `docs/`, none of which fall under `scripter`'s scope (`<skill-name>/scripts/` only) or `skill-reviewer`'s scope (skill `.md` files only) — see this repo's `.claude/agents/`. Single plan, architect-owned.

## Context

Arcanum has two existing per-repo config layers (`.claude/configuration/arcanum-repo-config.json`, committed; `.claude/state/arcanum-config.json`, gitignored/local), read via `arcanum/_lib/repo_config.sh`'s `repo_config_read`/`repo_config_write`. `agent_email_get` (`arcanum/_lib/agent_email.sh`) already manually chains local state -> repo config -> hardcoded model-email default for the `git.email` key, seeded by the already-released migration `arcanum/migrations/repos/0.14.0/002.sh`. This issue adds a global (per-account) tier below the repo config tier and above the hardcoded default, and a new migration that offers to set it once instead of the user answering `002.sh`'s prompt in every repo.

## Implementation Steps

### Step 1 — Add `arcanum/_lib/global_config.sh`

New file, mirroring `repo_config.sh`'s `repo_config_read`/`repo_config_write` shape but with no legacy-file parameter (nothing to migrate from) and resolved against a fixed path instead of caller-supplied file paths:

- `global_config_read <repo_path> <namespace> <key>` — prints (`jq -c`) `.{namespace}.{key}` from `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` if present, else nothing. `<repo_path>` is accepted but unused/ignored — kept only for signature consistency with every other arcanum script's leading-`repo_path` convention (document this explicitly in the file's header comment). Must not error if `$HOME`/`CLAUDE_CONFIG_DIR` don't resolve to an existing directory, or if the file is missing/malformed — degrade to "prints nothing," same as `repo_config_read`'s existing behavior for a malformed file.
- `global_config_write <repo_path> <namespace> <key> <json_value>` — same signature convention, locked via `arcanum/_lib/lock.sh` (lock file alongside the target: `arcanum-config.json.lock`), atomic write (`mv` from a `.tmp` file), `mkdir -p` the parent dir if missing. Default file permissions (`644`) — no extra restriction.

### Step 2 — Add `arcanum/_lib/config_chain.sh`

New file sourcing both `repo_config.sh` and `global_config.sh`. Exposes `config_chain_read <repo_path> <namespace> <key>`:

1. Read local state (`.claude/state/arcanum-config.json`, no legacy file) via `repo_config_read`.
2. If empty or the value is literally `null`, read repo config (`.claude/configuration/arcanum-repo-config.json`, no legacy file) the same way.
3. If still empty or `null`, read `global_config_read`.
4. Print the first present-and-non-null value found (raw, same shape `repo_config_read` prints); print nothing if all three tiers are empty/`null`. Callers apply their own hardcoded default on top, same convention as today.

The null-vs-absent fallthrough must be handled here explicitly at each tier (`repo_config_read`'s own presence check treats `null` as present) — this is the one place that logic needs to exist now that it's centralized instead of duplicated per caller.

### Step 3 — Rewire `agent_email_get`

In `arcanum/_lib/agent_email.sh`, replace the two manual `repo_config_read` calls with a single `config_chain_read ".claude/state/arcanum-config.json"`-style... — concretely: replace the existing two-call chain with one call to `config_chain_read "$REPO_PATH" git email` (source `config_chain.sh` instead of `repo_config.sh` directly), keeping the existing `null`-string strip and fallback-to-`model_email` logic unchanged around it. `agent_email_get` currently has no `repo_path` argument (operates on ambient cwd per its own doc comment) — `config_chain_read` needs one for `global_config_read`'s signature consistency, even though that argument goes unused; pass `"."` (already-entered cwd, matching the file's existing "no `repo_path` argument" convention) or thread an explicit repo path in if callers already have one available — confirm which fits the existing call sites in `commit_change.sh`/`commit_issue.sh`/`commit_plan.sh` before deciding.

### Step 4 — Add the new migration

Under `arcanum/migrations/repos/next/` (currently empty, `migrations.json` is `[]`):

- `001.sh` (`type: "script"`, `applies_to: "local"`, `skippable: true`) — `run` step:
  1. Check `config_chain_read` for local-state-or-repo-config `git.email` (i.e. the first two tiers only, not global) — if either already has a non-null value (e.g. set by `002.sh`), exit 0 immediately, no prompt (that repo is already satisfied).
  2. Otherwise check `global_config_read` for `git.email` — if already set, exit 0 immediately, no prompt (some other repo already answered this).
  3. Otherwise, mirror `0.14.0/002.sh`'s exact `_guess_default`/`[Y]es/[T]ype/[S]kip` `/dev/tty` idiom, but call `global_config_write` instead of `repo_config_write` when the user accepts/types a value. No-`/dev/tty` (automated) path: silently write the guessed default to the global file if one exists, same as `002.sh`'s non-interactive branch; skip if there's no guess.
- `001.md` — human-facing summary for the `[R]un/[S]kip/[C]hat` prompt, explaining this sets the *global*, cross-project default (as opposed to `002.sh`'s per-repo one) and is skippable/safe to re-run.
- Add the corresponding entry to `arcanum/migrations/repos/next/migrations.json`.

### Step 5 — Documentation

- `docs/agents/architecture.md` — add a third row to the config-files table (path, format, resolution role) for the new global file, and a short new subsection introducing `global_config.sh`/`config_chain.sh`, alongside the existing `repo_config.sh` narrative. Note the new migration under "Per-Repo Migrations".
- `docs/agents/folder-structure.md` — extend the config-files row to mention the new file lives under `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`, not inside the repo.
- `docs/guides/arcanum-global-config.md` (new) — end-user-facing guide mirroring `docs/guides/arcanum-repo-config.md`'s style: what the file is, where it lives, the full resolution order, how to set it (via the new migration or by hand).
- `docs/guides/arcanum-repo-config.md` — add a cross-link to the new guide.

(Splitting `docs/agents/architecture.md` itself into per-topic files is tracked separately in #167 — independent of this issue, can land in either order; this plan documents against `architecture.md` as it exists today regardless of whether #167 has landed yet.)

## Files to Change

- `arcanum/_lib/global_config.sh` — new: `global_config_read`/`global_config_write`.
- `arcanum/_lib/config_chain.sh` — new: `config_chain_read`, the composing 3-tier lookup with null-fallthrough handling.
- `arcanum/_lib/agent_email.sh` — rewire `agent_email_get` to call `config_chain_read` instead of two manual `repo_config_read` calls.
- `arcanum/migrations/repos/next/001.sh` — new migration script (global `git.email` prompt).
- `arcanum/migrations/repos/next/001.md` — new migration's human-facing summary.
- `arcanum/migrations/repos/next/migrations.json` — add the `001` entry (currently `[]`).
- `docs/agents/architecture.md` — document the new config layer + migration.
- `docs/agents/folder-structure.md` — document the new file's location.
- `docs/guides/arcanum-global-config.md` — new end-user guide.
- `docs/guides/arcanum-repo-config.md` — cross-link to the new guide.

## Notes

- No dedicated regression script required (per discuss-issue decision) — matches this repo's current default of manual verification, per `docs/agents/todo.md`.
- Malformed/corrupt global JSON degrades silently to "no value," same as `repo_config_read`'s existing behavior for a malformed local/repo file — no new warning path introduced.
- Global file permissions: default `644`, no extra restriction.
- `002.sh` (already released, `0.14.0`) is never touched — the new migration is purely additive under `next/`.
- Only `agent_email_get` is rewired to `config_chain_read` in this issue; every other `repo_config_read` call site (`auto-fix-all`'s config, `safe_branch.sh`) is untouched, per the issue's own "Which keys qualify" scoping — other keys can adopt `config_chain_read` later, feature-owner by feature-owner.
- Open implementation detail to resolve while coding Step 3: exactly how `agent_email_get` obtains the `repo_path` value to pass through to `config_chain_read`/`global_config_read` (unused by the latter, but required for signature consistency) — check `commit_change.sh`/`commit_issue.sh`/`commit_plan.sh`'s existing call sites, all of which already call `repo_path_enter` before sourcing `agent_email.sh`.
