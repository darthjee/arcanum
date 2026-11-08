# Issue: Document every config setting and where it is read from

## Description

Part of #900. Owner: **architect**. Depends on: nothing.

Add a new doc, `docs/agents/architecture/config-keys.md`, that lists every arcanum config key and where it is read from, recording **today's** behavior. It is the reference #902/#903/#905 (moving reads onto the registry) and #907 (reviewing tiers) work from. Its main table is temporary: #909 replaces it with a pointer to `shared/lib/config/keys.json` once reads are registry-driven.

## Problem

- There is no single place that says where each config key is read from. Key documentation is scattered: per-key tables in `docs/guides/arcanum-repo-config.md` ("Documented keys"), a list in `docs/guides/arcanum-global-config.md` ("Which keys use it"), and the registry's design in `docs/agents/architecture/shared-state-and-configuration.md`.
- `keys.json` declares each key's `tiers`, but those tiers only **describe** the readers; they don't **drive** them. Some keys are read through the chain (local → repo → global), others from one hardcoded file. A value placed in a tier the key isn't read from is silently ignored. The CLI checks tiers only when writing (`KeyRegistry#check`). In the ward session (#900), `git.safe_branch`, `auto-fix-all.clear_context` and `auto-fix-all.finish_on_empty_queue` were set in repo/global config and silently ignored this way.

## Expected Behavior

`docs/agents/architecture/config-keys.md` contains:

1. **Tier → file mapping**
   - local: `<repo>/.claude/state/arcanum-config.json`
   - repo: `<repo>/.claude/configuration/arcanum-repo-config.json`
   - global: `$CLAUDE_CONFIG_DIR/arcanum-config.json`

2. **Main table**, one row per `keys.json` key except the version pointers. Columns: **key | type | allowed tiers | default | read via | reader**.
   - **read via** is `chain` or `direct`:
     - `chain`: read through `config_chain_read` (shell) / `ConfigChain#read` (JS), local → repo → global. Today: `engine.mode`, `engine.log.location`, `git.email`, `git.agents.<agent>`, `git.merge_body_mode`, `git.omit_model_coauthor`, `git.remove_coauthors`, `next_step.auto.<skill>`, `next_step.clear.<skill>`, `plan-issues.max-retry-count`, `plan-issues.error-sleep-time`.
     - `direct`: read from one hardcoded file (`repo_config_read <file> …`, `RepoConfig`, `NamespacedBooleanKeyConfig`). Today: `git.safe_branch`, `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context` (local file); `auto-fix-all.ignored_check_patterns` (repo file).
   - **reader**: file and function, shell and JS when both exist (e.g. `arcanum/_lib/safe_branch.sh` → `safe_branch_get`; `shared/lib/config/RepoConfig.js` → `getSafeBranch`).
   - No separate "actually read from" column: today the declared tiers equal the tiers actually read for every key (chain-read keys all allow all three tiers; each direct-read key's single tier is exactly the file its reader hardcodes).

3. **A short paragraph on the two mechanisms**: `tiers` in `keys.json` currently describes the readers instead of driving them (until #902/#903), so changing `tiers` changes no read, and a value in another tier is ignored only because the reader never opens that file. The `direct` rows are what #902/#903 have to move. Also note that tiers are checked only when writing through the CLI (`KeyRegistry#check`).

4. **"Version pointers (not settings)"**, a separate short section linking to `docs/guides/arcanum-repo-version.md`:

   | Pointer | File | Written by | Read by |
   |---|---|---|---|
   | `version` (committed) | repo | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
   | `migrations.version` (local) | local | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
   | `migrations.version` (global) | global | migration runner only | `arcanum/migrations/run.sh` (`global_config_get_version`) |

   All three are `read_only` for the CLI. Note the registry gap: `keys.json` declares `migrations.version` with `tiers: ["local"]`, but the same dotted key also lives in the global file as a separate pointer (fixed in #907).

### Edge cases the doc must handle

1. **Wildcard keys** (`git.agents.<agent>`, `next_step.auto.<skill>`, `next_step.clear.<skill>`): one row each, keeping the placeholder; list known instances in the notes (e.g. `next_step.auto` → `enhance-issue`, `discuss-issue`, `auto-plan-issue`, from `setup.instances`).
2. **Chain rules**, stated once in the `chain` paragraph (from `ConfigChain#read`): the first value that is present and not `null` wins; `null` falls through, but `""` and `false` stop the chain (an explicit `false` in local overrides a `true` in global); a missing, unreadable or malformed file counts as absent.
3. **Two keys resolved together per tier**: `git.agents.<agent>` then `git.email` at each tier before moving on (`AgentEmail` / `agent_email.sh`), so a local `git.email` beats a global `git.agents.<agent>`. Note it on both rows.
4. **Keys with no default** (`engine.log.location`, `git.email`, `git.agents.<agent>`): show `—` and say briefly what happens when absent (e.g. no `git.email` → commits fall back to the model's email).
5. **Defaults** come from `keys.json`; the defaults drift spec (`core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`) guarantees they equal the code's.
6. **Dependent key**: `next_step.clear.<skill>` is read only when `next_step.auto.<skill>` is `true`.
7. **Shell-only or JS-only readers**: list what exists; no blanks that look like gaps.
8. **Namespace different from the reader**: `plan-issues.*` is read by `arcanum/_lib/spawn_issue_shell.sh` (and its JS twin, if any), not by `plan-issue`.

## Solution

### Where the doc lives

A new, dedicated file, `docs/agents/architecture/config-keys.md`:
- not a section of `shared-state-and-configuration.md` (already 154 lines covering the files, the registry design and `next_step`; this is a lookup, that doc explains how the system works);
- not under `docs/guides/` (the "reader" column is implementation detail for agents and contributors);
- a dedicated file keeps #909 small.

Links to add:
- `docs/agents/architecture.md` (index): a new entry;
- `docs/agents/architecture/shared-state-and-configuration.md` → "The key registry": a one-line pointer;
- `docs/guides/arcanum-repo-config.md` → "Documented keys" and `docs/guides/arcanum-global-config.md` → "Which keys use it": a "full list of keys: …" link at the top.

The guides' own per-key tables stay as they are (user-facing, explain behavior in prose). The temporary type/default duplication is resolved in #909.

### Scope

**In scope:** the new doc with the content under Expected Behavior, and the links above.

**Out of scope:**
- any code change, including `keys.json` (the `migrations.version` gap is only noted; fixed in #907);
- changing which tiers a key allows (#907);
- making reads go through the registry (#902 JS, #903 shell, #905 CLI);
- rewriting or merging the guides' own key tables (#909);
- removing the legacy `auto-fix-all.json`: at most a one-line footnote under `auto-fix-all.ignored_check_patterns` linking to `docs/guides/arcanum-repo-config.md` (removal is #904/#906);
- a spec checking the table against `keys.json` (the table is temporary);
- setup-wizard metadata (`setup.section`/`order`/`prompt`).

### Alternatives considered

- **A. Hand-written table (chosen):** can include "read via"/"reader", which `keys.json` doesn't hold; cheap; no code change. Drift risk lasts only until #909.
- **B. Generate the table from `keys.json`:** never drifts, but "read via"/"reader" would need new registry fields (a code change), too much for a temporary table. Noted on #909 as an option.
- **C. Skip #901 and go straight to #909:** #909 waits for #902/#903, and until then nothing explains why values in other tiers are ignored or which readers bypass the registry.
- **D. Rely on `arcanum config list` / `/arcanum-check-config`:** shows values and tiers, not readers, and isn't discoverable from the docs.

## Benefits

- One place that answers "where does key X come from, and why is my value ignored?"
- Gives #902/#903/#905 an exact list of the `direct` readers to move onto the registry, and #907 the current tiers to review.
- Explains the version pointers, so a global `migrations.version` behind the install (as in ward) isn't mistaken for a bug.
