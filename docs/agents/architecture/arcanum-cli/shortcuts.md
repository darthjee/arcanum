# Shortcuts and setup

Part of [Arcanum CLI](../arcanum-cli.md). This page describes curated config shortcuts and the setup wizard.

## Shortcut namespaces

Curated shortcuts live under `arcanum config`:

```text
arcanum config agents email
arcanum config engine [shell|native|docker | --unset]
arcanum config next-step auto [<skill> [on|off | --unset]]
arcanum config git safe-branch [<ref> | --unset]
arcanum config git merge-body [full|empty|coauthors | --unset]
arcanum config auto-fix-all clear-context [on|off | --unset]
arcanum config auto-fix-all finish-on-empty-queue [on|off | --unset]
arcanum config auto-fix-all ignore-checks [list | add <pattern>... | remove <pattern>...]
arcanum config monitor-issues clear-context [on|off | --unset]
```

Shortcuts delegate to generic get/set/unset and add only resolution or array-edit conveniences.

| Shortcut | Default write tier |
|---|---|
| agents email | global |
| engine | local |
| next-step auto | local |
| git safe-branch/merge-body | local |
| auto-fix-all toggles | local |
| ignore-checks | repo |
| monitor toggle | local |

Default tiers come from the key registry. `--global`, `--repo` or `--local` may override only allowed tiers.

Boolean tokens are lowercase `on`, `off`, `true`, `false` and store JSON booleans. Anything else exits `3`. Shortcut writes refuse `--force` and `--string`.

## Shortcut output

A shortcut prints exactly what the delegated generic command would print in human or JSON mode. A write to a shadowed tier adds a stderr note.

`next-step auto` with no skill lists set `next_step.auto.*` keys sorted by skill. It always exits `0` even if none are set.

## Agents email

Resolution matches `arcanum/_lib/agent_email.sh`: local → repo → global tiers, and `git.agents.<agent>` before `git.email` within a tier.

Listed agents are configured overrides plus repo `.claude/agents/*.md` basenames. Listing/detail/matrix show effective values and shadowing. Agent names `set`, `unset` and `edit` remain reserved as shortcut verbs and can be addressed through explicit commands according to the normal parsing rules.

Writes default to global; tier flags override. The editor prints the matrix, asks agent/value/tier and confirms each write/unset. It is interactive only and refuses JSON/output flags that would conflict with TTY behavior.

## Ignore checks

`auto-fix-all.ignored_check_patterns` is read local-then-repo at runtime. The shortcut's default tier is repo, with local allowed.

- `list`/`add`/`remove` operate on one tier.
- `add` appends distinct patterns; `remove` skips missing patterns.
- Each added pattern must compile case-insensitively with `new RegExp`.
- A stored non-array is refused `3`.
- JSON and human output follow the generic result patterns.
- `/init-claude` replaces the whole list; the shortcut edits incrementally under the same lock.

## Setup wizard

`arcanum config setup [<section>...] [--lock-timeout <seconds>]` uses registry-driven setup fields. Sections always run: identity, engine, git, flow, ci. Request order and duplicates do not affect execution order.

Without a configured repo, repo-dependent items and the per-agent/CI sections are skipped with notes. If nothing remains, exit `4`.

The wizard needs TTY stdin and stderr; `--json` and an interactive-only setup conflict. Each item shows current value/source, accepts Enter to keep or `-` to unset, asks an allowed tier and confirms the exact write. Values and tiers are re-asked after validation errors.

Wizard writes are immediate and atomic. Write failures are recorded and the wizard continues. EOF or SIGINT exits `130` after printing a summary of written, kept, failed and not-reached items.
