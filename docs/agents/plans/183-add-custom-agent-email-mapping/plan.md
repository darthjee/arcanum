# Plan: Add custom agent email mapping

Issue: [183-add-custom-agent-email-mapping.md](../issues/183-add-custom-agent-email-mapping.md)

## Overview
Add a `git.agents.<agent_name>` config mapping that lets one or more agent names resolve to a single, explicit commit-author email, taking precedence over the existing `git.email` templated pattern. This requires generalizing the shared config-reading primitives (`config_chain_read`, `repo_config_read`, `global_config_read`) to support multiple candidate keys tried per config tier, and dotted nested-key paths — then wiring `agent_email_get` to use the new `git.agents.${agent}` / `git.email` pair.

## Context
`arcanum/_lib/agent_email.sh`'s `agent_email_get` currently resolves the commit-author email via a single call, `config_chain_read "." "git" "email"`, which reads one flat key across 3 tiers (local state → repo config → global config), stopping at the first tier with a present, non-null value. Giving distinct agent names distinct GitHub identities today means baking them into the `{agent}`-templated `git.email` pattern, which forces one GitHub account per agent name — even when multiple agent names (e.g. across repos) should share one identity.

The new `git.agents` map needs **per-tier, two-key precedence**: within each tier, try `git.agents.<agent_name>` first, then `git.email`; only advance to the next tier if neither resolves in the current one. This is stronger than resolving each key independently across all tiers (which would let a lower tier's agent-specific value beat a higher tier's generic value — wrong, since a whole tier is supposed to be resolved before the next tier is ever consulted).

Full precedence and a worked example are in the issue's "Expected Behavior" section — implement exactly that.

## Implementation Steps

### Step 1 — Extend `repo_config_read`/`global_config_read` to support dotted-path keys
In `arcanum/_lib/repo_config.sh`, `repo_config_read <new_file> <legacy_file> <namespace> <key>` currently reads `.[$namespace][$key]` (single segment). Extend it so that when `$key` contains a `.`, it's resolved as a nested path under `$namespace` via jq `getpath` instead of direct indexing — e.g. key `agents.architect` under namespace `git` resolves `.git | getpath(["agents","architect"])`. Keys without a `.` must behave exactly as before (direct `.[$ns][$k]` indexing) — this is purely additive, and none of the ~6 existing call sites (`safe_branch.sh`, `arcanum-split-issue/create_sub_issue.sh`, `auto-fix-all/config.sh` (×3 call sites), `auto-fix-all/wait_ci.sh`) use dotted keys today, so their behavior must not change.

The presence check (`jq -e ... has($k)` today) needs the equivalent nested-path treatment: a `getpath` lookup that doesn't exist and one that's explicitly `null` both count as "absent" — consistent with the convention already documented in `config_chain.sh` (an explicit JSON `null` at any tier is treated the same as absent). Apply the same dotted-path extension to `global_config_read` in `arcanum/_lib/global_config.sh`, mirroring whatever internal lookup approach `repo_config_read` ends up using.

Legacy-file fallback (the `<legacy_file>` branch in `repo_config_read`) only needs to keep working for flat keys — no known legacy file has ever stored a nested key, so no dotted-path support is needed there.

### Step 2 — Make `config_chain_read` accept multiple candidate keys
In `arcanum/_lib/config_chain.sh`, change `config_chain_read <repo_path> <namespace> <key>` to `config_chain_read <repo_path> <namespace> <key1> [<key2> ...]` (variadic). For each of the 3 tiers in order (local state, repo config, global config), loop through the given keys in order and return the first present-and-non-null value found in that tier; only move to the next tier once every key has been tried and found absent/null in the current one. Existing single-key callers (`config_chain_read "." "git" "email"`, `config_chain_read "." "git" "omit_model_coauthor"`, `config_chain_read "." "git" "merge_body_mode"`) are unaffected — a single key is just the degenerate case of the loop.

Update the function's header comment to describe the new variadic signature and per-tier, multi-key resolution order.

### Step 3 — Wire `agent_email_get` to the new `git.agents`/`git.email` pair
In `arcanum/_lib/agent_email.sh`, change `agent_email_get`'s lookup from:
```bash
email=$(config_chain_read "." "git" "email")
```
to:
```bash
email=$(config_chain_read "." "git" "agents.${agent}" "email")
```
The rest of the function (stripping quotes, treating `null`/empty as absent, falling back to `<model_email>`, substituting `{agent}` into whatever pattern was found) stays as-is — note that a resolved `git.agents.<agent_name>` value is a concrete, literal email (not a `{agent}`-templated pattern), so the existing `${email//\{agent\}/$agent}` substitution is a harmless no-op when there's no `{agent}` placeholder in it. Update the function's header comment to describe the new two-key precedence.

### Step 4 — Update docs
- `docs/guides/arcanum-repo-config.md`: add a `git.agents` row to the config table, next to the existing `git.email` row — type `object (map of agent name -> email)`, default `—`, resolution `local → repo → global`, description noting it's consulted before `git.email` per agent (link back to `arcanum/_lib/agent_email.sh`).
- `docs/agents/architecture/shared-state-and-configuration.md`: update the description of `config_chain_read <repo_path> <namespace> <key>` to reflect the variadic-keys signature and per-tier multi-key resolution, and drop the line stating `git.email` is "the first (and, for now, only) key wired into this chain" (now `git.agents.<agent_name>` is wired in alongside it).

## Files to Change
- `arcanum/_lib/repo_config.sh` — `repo_config_read`: support dotted-path keys via `getpath`, flat keys unchanged.
- `arcanum/_lib/global_config.sh` — `global_config_read`: same dotted-path support, mirroring `repo_config_read`.
- `arcanum/_lib/config_chain.sh` — `config_chain_read`: variadic keys, per-tier/multi-key loop; update header comment.
- `arcanum/_lib/agent_email.sh` — `agent_email_get`: call `config_chain_read "." "git" "agents.${agent}" "email"`; update header comment.
- `docs/guides/arcanum-repo-config.md` — add `git.agents` row to the config table.
- `docs/agents/architecture/shared-state-and-configuration.md` — update `config_chain_read` description.

## Notes
- No migration needed (per the issue) — `git.agents` is a new, optional key; absence behaves exactly like today.
- No dedicated test suite exists for this area today (no equivalent of `arcanum/_lib/test_origin_resolution.sh`), so this ships without new automated tests, consistent with the rest of `arcanum/_lib`.
- Scope is intentionally narrow: the dotted-path/multi-key support in the shared primitives should only cover what `git.agents`/`git.email` needs — no speculative generalization for hypothetical future callers.
