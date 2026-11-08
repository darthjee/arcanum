# Issue: Add a per-tier view and an interactive editor to `arcanum config agents email`

## Description
Add to the `arcanum` client (cli/) a focused way to inspect and configure the agents' commit-author emails: list the agents of the repo (`.claude/agents/`) together with every agent already configured, show for each one which configuration tiers (local, repo, global) define its email and which don't, and let the user set or unset those emails interactively.

### What already exists
- `arcanum config agents email` (`cli/lib/commands/config/shortcuts/agentsEmail.js`) lists every agent in `.claude/agents/*.md` plus any configured agent, with only the **effective** email and the tier/key it resolves from. `agents email <agent>` shows the per-tier breakdown for **one** agent. `agents email set|unset` write one value at a time (default tier global).
- `arcanum config setup identity` (`cli/lib/commands/config/setup/identity.js`) asks the `git.email` pattern and then, behind an opt-in, walks every repo agent asking value + tier.

## Problem
There is no single view of **all** agents × **all** tiers: the listing shows only the winning value, and the per-tier detail covers one agent at a time. To find which agents/tiers are missing an email the user has to run the detail for each agent. Setting them means either typing one `agents email set` per value or running the whole `config setup identity` wizard, which re-asks every agent regardless of what is already configured.

## Expected Behavior
1. **Per-tier matrix — `arcanum config agents email --all-tiers`**: one row for the generic default (`git.email`) and one row per agent (repo agents + configured ones), one column per tier (local / repo / global). Each cell shows the value stored at that tier (`git.agents.<agent>` for agent rows, `git.email` for the default row) or `-`. The resolved value is marked, shadowed values are shown as such, and agents falling back to the model default are flagged. `--json` returns the matrix as a new, separate JSON shape.
2. **Interactive editor — `arcanum config agents email edit`**: shows the matrix, asks for an agent (one of the listed agents, or `default` for `git.email`), the email (or `-` to unset), and the tier (default `global`), confirms, writes through the same path as `agents email set`/`unset`, re-renders the matrix and loops until the user finishes (empty agent answer).

```
$ arcanum config agents email --all-tiers
agent      local   repo         global
(default)  -       -            you+{agent}@x.com
node       -       node@x.com   -                   <- repo
client     -       -            -                   <- global (default: you+client@x.com)
mod        -       -            -                   (not in this repo) <- global (default: you+mod@x.com)

$ arcanum config agents email edit
? agent [node/client/mod/default] (empty to finish): mod
? email (- to unset): mod-bot@x.com
? tier [local/repo/global] (global): repo
  write git.agents.mod = mod-bot@x.com to repo? [Y/n]
```

Exact rendering is for the implementation to settle; the example only fixes the information shown.

### Edge cases
- **Outside a repo** — local/repo columns show "(no target)"; the editor offers only the `global` tier; the agent list is only the agents configured in global.
- **No agents at all** (none in `.claude/agents/`, none configured) — the matrix shows only the default row; the editor offers only `default`.
- **Configured agents not in the repo** — listed with a "(not in this repo)" marker, and selectable in the editor.
- **Agent choice in the editor** — restricted to the listed agents plus `default`; unknown names are rejected with a hint to use `agents email set <agent> <email>`.
- **Per-tier precedence** — within each tier `git.agents.<agent>` beats `git.email`, but a `git.email` at a higher-precedence tier beats a `git.agents.<agent>` at a lower one. The matrix must make the winner explicit so a set cell is never mistaken for the effective one.
- **`{agent}` template** — the default row shows the raw `git.email` pattern; agent rows resolving from it show the substituted email.
- **Explicit empty `""`** — displayed as `""` and marked as forcing the model default; JSON `null` is treated as absent (`-`). The editor does not offer storing `""`.
- **Email format** — not validated (consistent with `agents email set`).
- **Malformed tier files** — same read warnings as the other `config` read commands; the readable tiers still render.
- **No TTY** — `agents email edit` fails with a usage error pointing to `agents email set|unset`; `--all-tiers` works everywhere.

### Backward compatibility
- `arcanum config agents email` with no flag keeps its current human output and JSON shape (`{ default, agents }`).
- `--all-tiers`, currently rejected by `agents email` ("it always shows every tier"), becomes accepted on the listing form. Tier flags (`--local`/`--repo`/`--global`) and `--unset` stay rejected on read forms; on the detail form (`agents email <agent>`) `--all-tiers` stays rejected.
- `edit` becomes a reserved verb like `set`/`unset`: an agent literally named `edit` can no longer be inspected with `agents email edit` (it still appears in the listing/matrix and can be written with `set`). The guide documents the reserved names.
- No config file shape change, no change to `arcanum/_lib/agent_email.sh` or `AgentEmail` resolution — no migration needed.

## Solution
All work is in `cli/` (owner: `client` agent), under the existing `agents email` shortcut:

- `cli/lib/commands/config/shortcuts/agentsEmail.js`: accept `--all-tiers` on the listing form and render the matrix, reusing `readEmailTiers()`, `repoAgents()`, `configuredAgents()` and `AgentEmail#resolve` (the per-agent marking logic of `showAgent`/`detailText` generalised to every agent); add the `edit` verb.
- Editor: reuse the `config setup` prompt helpers (`cli/lib/commands/config/setup/setting.js` — `askTier`, `confirm`, the `-` unset answer) and the shortcut write path (`writeValue` / `delegate` in `shortcuts/common.js`); fail with a usage error when no TTY is available.
- Specs under `cli/spec/lib/commands/config/shortcuts/` for the matrix (human + JSON, in/out of repo, precedence/shadowing, `""`, `{agent}` substitution, not-in-repo agents) and the editor (agent restriction, unset, tier restriction outside a repo, loop exit, no-TTY error).
- Docs: `cli/lib/help.js`, `cli/README.md`, `docs/guides/arcanum-cli.md` (including reserved verbs) and `docs/agents/architecture/arcanum-cli.md#agents-email`.

Out of scope: changing the resolution order, changing `config setup identity`, adding a new top-level command.

## Benefits
- One command shows exactly which agents/tiers have an email and which commits will fall back to the model default.
- Missing emails can be filled in one interactive session without re-running the whole setup wizard.
- What is shown matches what `arcanum/_lib/agent_email.sh` commits with, since both go through the shared resolution.
