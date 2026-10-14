# Arcanum CLI: Shortcuts and Setup

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the curated shortcuts over common config keys and the interactive `arcanum config setup` wizard. Both sit on top of the generic layer in [Command Surface](command-surface.md) and the [Key Registry](key-registry.md).

## Decisions

### Shortcut set

All shortcuts live under `arcanum config`:

```text
arcanum config agents email                       # show default + per-agent emails, with tiers
arcanum config agents email set <pattern>         # git.email, e.g. you+{agent}@example.com
arcanum config agents email set <agent> <email>   # git.agents.<agent>
arcanum config agents email unset [<agent>]
arcanum config engine [shell|native|docker]       # show / set engine.mode
arcanum config next-step auto <skill> [on|off]    # next_step.auto.<skill>
arcanum config git safe-branch [<ref>]            # git.safe_branch
arcanum config git merge-body [full|empty|coauthors]   # git.merge_body_mode
arcanum config auto-fix-all clear-context [on|off]          # auto-fix-all.clear_context
arcanum config auto-fix-all finish-on-empty-queue [on|off]  # auto-fix-all.finish_on_empty_queue
arcanum config auto-fix-all ignore-checks [list|add|remove] [<pattern>]  # auto-fix-all.ignored_check_patterns
arcanum config monitor-issues clear-context [on|off]        # monitor-issues.clear_context
```

| Shortcut | Key(s) | Default tier |
| --- | --- | --- |
| `agents email` | `git.email`, `git.agents.<agent>` | global |
| `engine` | `engine.mode` | local |
| `next-step auto <skill>` | `next_step.auto.<skill>` | local |
| `git safe-branch` | `git.safe_branch` | local |
| `git merge-body` | `git.merge_body_mode` | local |
| `auto-fix-all clear-context` | `auto-fix-all.clear_context` | local |
| `auto-fix-all finish-on-empty-queue` | `auto-fix-all.finish_on_empty_queue` | local |
| `auto-fix-all ignore-checks` | `auto-fix-all.ignored_check_patterns` | repo |
| `monitor-issues clear-context` | `monitor-issues.clear_context` | local |

`monitor-issues clear-context` becomes available only after #776 moves that key into the three-tier config (see [Related work](../arcanum-cli.md#related-work-outside-this-spec)).

### Design rules

- Every shortcut is a thin front-end over a registry entry, or a group of entries. It adds no behaviour that generic `config get/set` lacks, except array `add`/`remove` (e.g. `ignore-checks`).
- Shortcut namespaces mirror config namespaces (`git`, `auto-fix-all`, `monitor-issues`, `next-step`, `engine`). `agents email` is the exception: it stays under `agents` because it reads naturally and leaves room for more per-agent settings.
- Without a value, a shortcut shows the current value and its source tier.
- Each shortcut has the default tier in the table above. `--global`, `--repo` or `--local` overrides it.
- Tuning knobs such as `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` get no shortcut. They stay reachable through generic `config set`.

### `arcanum config setup` wizard

The wizard is in scope.

- It walks through the common settings on a TTY: the agents' emails, engine mode, next-step auto toggles, and so on. The registry drives which keys are asked, their types and their sensible tiers.
- For each setting it shows the current value and its source tier, asks for the new value and the target tier, and confirms before writing.
- It requires a TTY. The CLI runs outside Claude, so there is no `AskUserQuestion` fallback. Without a TTY, it exits with a clear error that points at the non-interactive commands.

## Alternatives considered

- **`git email` instead of `agents email`.** Rejected: the setting is about the agents, and `agents` leaves room for more per-agent settings.
- **Leaving `monitor-issues.clear_context` out of the CLI**, because it lives in its own file. Rejected in favour of consolidating it into the three-tier config first (#776), so the CLI only deals with the three tier files.
- **Leaving the wizard out of scope.** Rejected: it gives new users a guided path through the common settings.

## Open points

- The exact output of each shortcut, in human and `--json` modes.
- Which settings the wizard covers, and in what order.
- Wizard behaviour on partial completion or Ctrl-C (whether already-confirmed writes are kept).
- How `agents email` displays the effective email per agent across tiers.
