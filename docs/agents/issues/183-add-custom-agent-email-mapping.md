# Issue: Add custom agent email mapping

## Description
Right now, the commit-author email used for an agent is read from configuration (local, repo, global) as a single templated pattern:

```json
{
  "git": {
    "email": "something+{agent}@something.com"
  }
}
```

`{agent}` is substituted with the agent's name (e.g. `architect`), so each distinct agent name gets its own generated email address.

## Problem
Because each agent name maps to its own generated email via the `{agent}` template, giving an agent a proper GitHub identity (avatar/picture) requires creating a dedicated GitHub account per agent name.

This breaks down when multiple agent *names* across different repos should really be a single logical identity on GitHub — e.g. a Python agent and a Node agent in two different repos that are both conceptually a "backend agent". Today that means either creating two separate GitHub accounts for what's really one identity, or losing the per-agent email distinction entirely.

## Expected Behavior
When resolving an agent's commit-author email, the config should support an explicit `agent name -> concrete email` mapping that takes precedence over the generic `git.email` pattern, resolved **per tier** (local → repo → global), in this order:

- local:
  - `git.agents.<agent_name>`
  - `git.email`
- repo:
  - `git.agents.<agent_name>`
  - `git.email`
- global:
  - `git.agents.<agent_name>`
  - `git.email`
- if none of the above resolve, the caller's own hardcoded default (e.g. `<model_email>` in `agent_email_get`) applies, same as today.

### Worked example
Agent is `architect`. Tier-by-tier:
- **local**: `git.agents` exists as an object, but has no `architect` key (or `git.agents` is absent entirely) → `agents.architect` is treated as absent → try `git.email` in local → also absent/null → move to next tier.
- **repo**: same two-key check. Suppose neither resolves either → move to next tier.
- **global**: same two-key check. Suppose `git.email` is set here → **that value is used** — even though nothing anywhere set an agent-specific mapping.
- If global also has neither key, the final fallback is the caller's default (`<model_email>`).

Note the tier boundary is never crossed mid-check: e.g. an agent-specific `git.agents.architect` at the *repo* tier does **not** get picked over a generic `git.email` at the *local* tier, because local as a whole tier is resolved (both its keys tried and found empty) before repo is ever consulted.

## Solution
Add a custom agent mapping to the configuration, alongside the existing `git.email` pattern:

```json
{
  "git": {
    "email": "something+{agent}@something.com",
    "agents": {
      "<agent_name>": "concrete_email@server.com"
    }
  }
}
```

### Implementation
This is the first time we have 2-key precedence within the same tier, and it exposes two gaps in the current shared config-reading primitives (`arcanum/_lib/config_chain.sh`, `arcanum/_lib/repo_config.sh`, `arcanum/_lib/global_config.sh`):

1. `config_chain_read(repo_path, namespace, key)` only accepts a single flat key. It needs to accept multiple candidate keys, tried **per tier** (local → repo → global), advancing to the next tier only when none of the keys resolve in the current one — e.g. `config_chain_read "." "git" "agents.${agent}" "email"`. This is what makes the decision flow above correct: a generic `git.email` set at a higher-precedence tier (e.g. local) must still beat an agent-specific `git.agents.<agent_name>` set at a lower-precedence tier (e.g. repo) — trying each key independently across all tiers would get this wrong.
2. `repo_config_read`/`global_config_read` only support a single-segment key (`.<namespace>.<key>`) — nothing in the codebase today reads a nested key like `agents.<agent_name>`. Extend `key` to accept a dot-separated path (via jq `getpath`), falling back to today's flat-key behavior when there's no dot. This is purely additive: none of the ~6 existing call sites (`safe_branch.sh`, `arcanum-split-issue/create_sub_issue.sh`, `auto-fix-all/config.sh`, `auto-fix-all/wait_ci.sh`, plus `config_chain.sh`'s own callers) use dotted keys today, so their behavior is unchanged.

`agent_email_get` (in `arcanum/_lib/agent_email.sh`) then becomes a single call: `config_chain_read "." "git" "agents.${agent}" "email"`, with the existing `<model_email>` fallback applying only when that whole chain is empty.

The `null`-vs-absent convention already established for flat keys (an explicit JSON `null` at any tier is treated as absent, falling through to the next tier) applies unchanged to nested `getpath` lookups too — `getpath` naturally returns `null` for both "the path doesn't exist" and "the value is explicitly null", so no new semantic case is introduced.

### Scope
`config_chain.sh` already exists specifically as a shared, reusable primitive (its own header states its purpose is to save every caller from hand-rolling the 3-tier chain), so the multi-key/dotted-path support belongs there as a general capability, not one-off logic bolted onto `agent_email.sh`. That said, this issue's scope stays narrow: only what `git.email`/`git.agents` needs. No speculative edge-case handling or documentation for hypothetical future callers/keys — extend it further only when an actual second use case shows up.

### Testing & docs
No dedicated test suite exists for `agent_email.sh`/`config_chain.sh` today (there's no equivalent of `arcanum/_lib/test_origin_resolution.sh` for this area), so this ships without new automated tests — consistent with the rest of this area.

Docs that describe the current single-key chain and need updating:
- `docs/guides/arcanum-repo-config.md` — add a `git.agents` row to the config table (alongside the existing `git.email` row), documenting it as `object (map of agent name -> email)`, resolved local → repo → global, consulted before `git.email` per agent.
- `docs/agents/architecture/shared-state-and-configuration.md` — update the `config_chain_read <repo_path> <namespace> <key>` signature description to reflect the variadic-keys change, and drop the "`git.email` is the first (and, for now, only) key wired into this chain" line, since `git.agents.<agent_name>` is now wired in alongside it.

### Migration
No migration needed.

## Benefits
- Multiple agent names (e.g. a Python agent and a Node agent, or agents across different repos) can share a single GitHub identity/avatar instead of requiring one dedicated GitHub account per agent name.
- The generic `git.email` pattern keeps working unchanged for agents that don't need a custom mapping — the new `git.agents` map is purely additive and opt-in per tier.
- The underlying `config_chain_read` primitive becomes more broadly reusable (multi-key, nested-path lookups) for future config needs, without changing behavior for any of its existing callers.
