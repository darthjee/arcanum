# Plan: Document every config setting and where it is read from

Issue: [901-document-every-config-setting-and-where-it-is-read-from.md](../../issues/901-document-every-config-setting-and-where-it-is-read-from.md)

## Overview

Docs-only change. Add `docs/agents/architecture/config-keys.md`, a lookup reference listing every arcanum config key in `shared/lib/config/keys.json` with its type, allowed tiers, default, read mechanism (`chain` / `direct`) and exact reader(s), plus a separate section on the three migration version pointers. Link it from the architecture index, the registry section and the two config guides. No code or `keys.json` changes.

## Context

Part of epic #900. `keys.json` declares each key's `tiers`, but those tiers only describe the readers: chain-read keys go through `config_chain_read` / `ConfigChain#read` (all three tiers), while direct-read keys read one hardcoded file. Values placed in another tier are silently ignored, and the CLI checks tiers only on write (`KeyRegistry#check`). Key documentation is scattered across `docs/guides/arcanum-repo-config.md`, `docs/guides/arcanum-global-config.md` and `docs/agents/architecture/shared-state-and-configuration.md`. The table is temporary: #909 replaces it with a pointer to `keys.json` once #902/#903 make reads registry-driven.

Ownership: `docs/agents/` is the architect's (coordinator) scope; no specialist agent has work, so this is a single, unsplit plan.

## Implementation Steps

### Step 1 — Write `docs/agents/architecture/config-keys.md`

Create the doc with these sections, in order:

1. **Intro** (2–3 sentences): what the doc is, that it records today's behavior, and that #909 will replace the table with a pointer to `keys.json`.
2. **Tiers and files**: the tier → file mapping (local `<repo>/.claude/state/arcanum-config.json`, repo `<repo>/.claude/configuration/arcanum-repo-config.json`, global `$CLAUDE_CONFIG_DIR/arcanum-config.json`, falling back to `$HOME/.claude/` as in `docs/guides/arcanum-global-config.md`).
3. **How keys are read**: one short paragraph per mechanism.
   - `chain`: `config_chain_read` (`arcanum/_lib/config_chain.sh`) / `ConfigChain#read` (`shared/lib/config/ConfigChain.js`), local → repo → global. State the chain rules from `ConfigChain#read`'s JSDoc: first present, non-`null` value wins; `null` falls through; `""` and `false` stop the chain (an explicit local `false` overrides a global `true`); a missing, unreadable or malformed file counts as absent.
   - `direct`: one hardcoded file via `repo_config_read <file> …` (`arcanum/_lib/repo_config.sh`), `RepoConfig` (`shared/lib/config/RepoConfig.js`) or `NamespacedBooleanKeyConfig` (`core/lib/utils/config/NamespacedBooleanKeyConfig.js`).
   - Then: `tiers` in `keys.json` currently **describes** the readers rather than driving them (until #902/#903); today declared tiers equal what's read for every key; changing `tiers` changes no read; a value in another tier is ignored because the reader never opens that file; tiers are only enforced on CLI writes (`KeyRegistry#check` in `shared/lib/config/KeyRegistry.js`). The `direct` rows are the ones #902/#903 move onto the registry.
4. **Settings table**: columns `Key | Type | Tiers | Default | Read via | Reader | Notes`, one row per non-pointer key in `keys.json` (verify the list against the file at implementation time):
   - `engine.mode`, `engine.log.location` — chain; readers `arcanum/_lib/engine_dispatch.sh` (`engine_dispatch`), `arcanum/_lib/engine_dispatch_docker.sh` (log location); add the JS reader if `core/` has one.
   - `git.email`, `git.agents.<agent>` — chain, resolved together per tier (`git.agents.<agent>` first, then `git.email`, before the next tier; a local `git.email` beats a global `git.agents.<agent>`); readers `arcanum/_lib/agent_email.sh` (`agent_email_get`), `shared/lib/config/AgentEmail.js`; no default: with nothing set, commits fall back to the model's email. Note on both rows.
   - `git.merge_body_mode` — chain; `arcanum/_lib/merge_body.sh`, `core/lib/utils/github/MergeBodyResolver.js`.
   - `git.omit_model_coauthor` — chain; `arcanum/_lib/agent_email.sh`, `core/lib/utils/git/CoauthorTrailers.js`.
   - `git.remove_coauthors` — chain; `arcanum/_lib/agent_email.sh` (plus any JS reader found).
   - `git.safe_branch` — direct, local file; `arcanum/_lib/safe_branch.sh` (`safe_branch_get`), `shared/lib/config/RepoConfig.js` (`getSafeBranch`).
   - `next_step.auto.<skill>` — chain; `arcanum/_lib/next_step_prompt.sh` (`--auto-key`) and `auto-plan-issue/scripts/auto_next*.sh`; known instances from `setup.instances`: `enhance-issue`, `discuss-issue`, `auto-plan-issue`.
   - `next_step.clear.<skill>` — chain; same readers; read only when the matching `next_step.auto.<skill>` is `true`.
   - `auto-fix-all.ignored_check_patterns` — direct, repo file; `auto-fix-all/scripts/wait_ci_shell.sh`, `shared/lib/config/RepoConfig.js`; note case-insensitive regex matching and a one-line footnote on the legacy `.claude/configuration/auto-fix-all.json` linking to `docs/guides/arcanum-repo-config.md`.
   - `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue` — direct, local file; `auto-fix-all/scripts/config_common.sh` (+ `config_*_shell.sh`), `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`.
   - `monitor-issues.clear_context` — direct, local file; `monitor-issues/scripts/config_common.sh` and its JS twin, if any.
   - `plan-issues.max-retry-count`, `plan-issues.error-sleep-time` — chain; read by `arcanum/_lib/spawn_issue_shell.sh` and `core/lib/commands/shared/SpawnIssue.js` (not by `plan-issue`).
   - Types, tiers and defaults come straight from `keys.json` (defaults are kept equal to the code by `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`); keys with no default show `—`. Wildcard keys keep their placeholder in one row. For readers that exist only in shell or only in JS, list what exists.
5. **Version pointers (not settings)**: the three-row table (`version` committed / repo file; `migrations.version` local / local file; `migrations.version` global / global file), with written-by and read-by (`arcanum/migrations/run.sh`, `global_config_get_version` in `arcanum/_lib/global_config.sh`), all `read_only` for the CLI, a link to `docs/guides/arcanum-repo-version.md`, and a note that `keys.json` declares `migrations.version` as local-only although the global file holds the same dotted key (fixed in #907).

Before writing each reader cell, confirm the file/function with a quick `grep` so the doc names real call sites.

### Step 2 — Link the new doc

- `docs/agents/architecture.md`: add a row to the index table, after "Shared State & Configuration Files", e.g. `| [Config Keys](architecture/config-keys.md) | Every config key: type, allowed tiers, default, and whether and where it is read through the chain or from one file; plus the migration version pointers. |`.
- `docs/agents/architecture/shared-state-and-configuration.md`, section "The key registry": one line pointing to `config-keys.md` for the per-key list.
- `docs/guides/arcanum-repo-config.md`, top of "Documented keys": a "Full list of keys and where each is read from: [Config Keys](../agents/architecture/config-keys.md)." line. Leave the existing tables untouched.
- `docs/guides/arcanum-global-config.md`, top of "Which keys use it": the same kind of line.

## Files to Change

- `docs/agents/architecture/config-keys.md` — new: the settings reference.
- `docs/agents/architecture.md` — add the index entry.
- `docs/agents/architecture/shared-state-and-configuration.md` — one-line pointer in "The key registry".
- `docs/guides/arcanum-repo-config.md` — one-line pointer in "Documented keys".
- `docs/guides/arcanum-global-config.md` — one-line pointer in "Which keys use it".

## CI Checks

- No CI job covers these Markdown files beyond the non-blocking `docs/agents/tag-mutations.md` check, which is unaffected. Check relative links resolve by hand (e.g. open each link target path).

## Notes

- Out of scope: any code or `keys.json` change, tier changes (#907), registry-driven reads (#902/#903/#905), rewriting the guides' tables (#909), removing the legacy `auto-fix-all.json` (#904/#906), a drift spec, and setup-wizard metadata.
- If the implementer finds a key whose actual reads differ from its declared tiers (contradicting the "they match today" statement), document what's actually read and note it on #902/#903 rather than changing code.
