# Issue: arcanum config shortcuts

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). It adds the curated `arcanum config` shortcuts: thin front-ends over registry entries, built on the generic `config get/set/unset` layer from #780.

`docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` (Shortcut set, Design rules, Output, `agents email`, `ignore-checks`, Edge cases, Testing) is the contract, together with [Command Surface](../specs/arcanum-cli/command-surface.md) for the shared output, JSON and exit-code rules. This issue does not repeat the spec; it sets the scope and what counts as done. The `arcanum config setup` wizard in the same spec is #782 and is out of scope here.

### Dependencies

- **#780** (generic `config` commands): the shortcuts reuse its parsing, targeting, tier reading, validation, skew, lock and output layers. It must be merged first.
- **#841** (sub-issue, owner `shared`): `RepoConfigWriter#update`, an atomic read-modify-write under the lock, which `ignore-checks add/remove` needs. It must be merged first.
- #776 (monitor-issues `clear_context` in the three-tier config) is merged.

## Solution

### Shortcuts

| Shortcut | Key(s) | Default write tier |
| --- | --- | --- |
| `agents email [<agent>]`, `agents email set <pattern>`, `agents email set <agent> <email>`, `agents email unset [<agent>]` | `git.email`, `git.agents.<agent>` | global |
| `engine [shell\|native\|docker \| --unset]` | `engine.mode` | local |
| `next-step auto [<skill> [on\|off \| --unset]]` | `next_step.auto.<skill>` | local |
| `git safe-branch [<ref> \| --unset]` | `git.safe_branch` | local (registry: local-only) |
| `git merge-body [full\|empty\|coauthors \| --unset]` | `git.merge_body_mode` | local |
| `auto-fix-all clear-context [on\|off \| --unset]` | `auto-fix-all.clear_context` | local |
| `auto-fix-all finish-on-empty-queue [on\|off \| --unset]` | `auto-fix-all.finish_on_empty_queue` | local |
| `auto-fix-all ignore-checks [list]`, `add <pattern>...`, `remove <pattern>...` | `auto-fix-all.ignored_check_patterns` | repo (only) |
| `monitor-issues clear-context [on\|off \| --unset]` | `monitor-issues.clear_context` | local |

### Behaviour

- **Single-value shortcuts:** with no value, a read; with a value, a set; `--unset` unsets. `--unset` together with a value is exit `2`. Writes go to the default tier unless a tier flag overrides it, within the tiers the registry allows. Reads ignore the default tier: they resolve like `config get`, take a tier flag to read one tier, and accept `--all-tiers`.
- **Same output as the generic command:** human, `--json` and exit codes are byte-identical to the equivalent `config get/set/unset`. That includes the unset read (exit `1`, with the registry `default` in the human line and the JSON). Booleans print as `true`/`false`.
- **Booleans:** `on`/`off`/`true`/`false`, lowercase only, always stored as JSON booleans. Any other token is exit `3` with the accepted tokens. `off` stores `false` so that it can shadow a lower tier.
- **Flags:** tier flags, global flags, and `--lock-timeout` on writes. `--force` and `--string` are refused.
- **`next-step auto`** without `<skill>` lists the set `next_step.auto.*` keys, resolved and sorted, and always exits `0`. Any well-formed skill name is accepted.
- **`agents email`:** resolution through the shared `AgentEmail` and `ConfigChain#readWithSource`, matching `arcanum/_lib/agent_email.sh`, including the `""` rule and `{agent}` substitution. The agents listed are the union of the configured ones and those in the repo's `.claude/agents/*.md`. Agents not in the repo are marked, and outside a repo only configured agents are listed. The listing, the per-agent detail view and the JSON shapes follow the spec.
- **`ignore-checks`:** repo tier only (`--local`/`--global` exit `3`). Patterns match by exact string. `add` appends in order and skips duplicates, `remove` skips missing patterns, and an absent key counts as `[]`. A value that isn't an array refuses with exit `3` and the fix-it hint. `add` validates every pattern with `new RegExp(p, 'i')` before writing anything. `add`/`remove` go through `RepoConfigWriter#update` (#841), so the read-modify-write happens inside the lock. JSON follows the `config set` shape plus `added`/`removed`.
- **Writing to a shadowed tier** is allowed, with a stderr note naming the tier that overrides it.

### Tests

Follow the spec's Testing section. Every shortcut form (read, set, `--unset`, tier override) gets a spec asserting byte-identical output against the generic command. Also: `next-step auto` listing specs, boolean-token specs, the `ignore-checks` cases (including a concurrency spec with two `add` calls against a lock held beforehand), and `agents email` resolution specs that reuse the `AgentEmail` shell/native parity fixture table, plus the listing specs in and outside a repo.

### Docs

Help text for each shortcut (stating that `ignore-checks` patterns are case-insensitive regexes, not globs), plus a shortcuts section in `cli/README.md`, the CLI architecture doc and the end-user guide that #780 introduces.

### Owner

`client`, in one PR, which only touches `cli/` (plus the docs above). Any other gap found in `shared/` becomes its own `shared` issue, as #841 did.

## Benefits

- The most common settings get short, discoverable commands with sensible default tiers, with no dotted keys or JSON quoting to remember.
- `agents email` shows the email each agent will actually commit with, and where it comes from.
- `ignore-checks` edits the CI ignore list incrementally and safely under concurrency.
