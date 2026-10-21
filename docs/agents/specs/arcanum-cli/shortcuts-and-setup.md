# Arcanum CLI: Shortcuts and Setup

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the curated shortcuts over common config keys and the interactive `arcanum config setup` wizard. Both sit on top of the generic layer in [Command Surface](command-surface.md) and the [Key Registry](key-registry.md). This part is the contract for each shortcut's syntax, default tier, output and JSON shape, for the `ignore-checks` array semantics, and for the wizard's coverage, order and flow.

## Decisions

### Shortcut set

All shortcuts live under `arcanum config`:

```text
arcanum config agents email                       # show default + per-agent effective emails, with tiers
arcanum config agents email <agent>               # per-tier breakdown for one agent
arcanum config agents email set <pattern>         # git.email, e.g. you+{agent}@example.com
arcanum config agents email set <agent> <email>   # git.agents.<agent>
arcanum config agents email unset [<agent>]       # git.email, or git.agents.<agent>
arcanum config engine [shell|native|docker | --unset]           # engine.mode
arcanum config next-step auto [<skill> [on|off | --unset]]      # next_step.auto.<skill>
arcanum config git safe-branch [<ref> | --unset]                # git.safe_branch
arcanum config git merge-body [full|empty|coauthors | --unset]  # git.merge_body_mode
arcanum config auto-fix-all clear-context [on|off | --unset]          # auto-fix-all.clear_context
arcanum config auto-fix-all finish-on-empty-queue [on|off | --unset]  # auto-fix-all.finish_on_empty_queue
arcanum config auto-fix-all ignore-checks [list]                      # auto-fix-all.ignored_check_patterns
arcanum config auto-fix-all ignore-checks add <pattern>...
arcanum config auto-fix-all ignore-checks remove <pattern>...
arcanum config monitor-issues clear-context [on|off | --unset]        # monitor-issues.clear_context
arcanum config setup [<section>...]               # interactive wizard
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
| `auto-fix-all ignore-checks` | `auto-fix-all.ignored_check_patterns` | repo (only) |
| `monitor-issues clear-context` | `monitor-issues.clear_context` | local |

Example: `arcanum config auto-fix-all ignore-checks add '^codacy'`.

`monitor-issues clear-context` is available because #776 moved that key into the three-tier config (see [Related work](../arcanum-cli.md#related-work-outside-this-spec)).

### Design rules

- **Thin front-ends.** Every shortcut is a thin front-end over a registry entry, or a group of entries. It adds no behaviour that generic `config get/set/unset` lacks, except array `add`/`remove` (`ignore-checks`) and the `agents email` resolution view.
- **Namespaces.** Shortcut namespaces mirror config namespaces (`git`, `auto-fix-all`, `monitor-issues`, `next-step`, `engine`). `agents email` is the exception: it stays under `agents` because it reads naturally and leaves room for more per-agent settings.
- **Two shapes of shortcut.**
  - *Single-value shortcuts* (`engine`, `git safe-branch`, `git merge-body`, `next-step auto <skill>`, `auto-fix-all clear-context`, `auto-fix-all finish-on-empty-queue`, `monitor-issues clear-context`) take the value positionally: no value shows it, a value sets it.
  - *Verb shortcuts* exist only where needed: `agents email [set|unset]`, which spans two keys (`set <pattern>` and `set <agent> <email>` are told apart by arity), and `auto-fix-all ignore-checks [list|add|remove]`, which edits an array.
- **Unset uses `--unset`** on single-value shortcuts, mirroring `git config --unset`: `arcanum config engine --unset [--repo]`. It writes to the shortcut's default tier unless a tier flag overrides it. `--unset` combined with a value is a usage error (exit `2`). The positional slot stays purely a value, so no reserved word can collide with a value (e.g. a ref named `unset`).
- **`agents email unset`** without an agent unsets `git.email`; with an agent, `git.agents.<agent>`.
- **Boolean toggles** accept `on`/`off` and `true`/`false`, lowercase only. They are always stored as JSON booleans, never strings, so the "only JSON `true`" rule of `next_step.auto.*` holds. Any other token is exit `3`, with a hint listing the accepted tokens.
- **`off` writes JSON `false`** at the target tier rather than removing the key, so it can shadow an `on` from a lower-precedence tier (e.g. turning off locally an auto-advance enabled globally). Removing the key is `--unset`.
- **Writes** go to the default tier in the table above. `--global`, `--repo` or `--local` overrides it, within the tiers the registry allows for the key.
- **Reads ignore the default tier.** Without a tier flag, a shortcut read shows the resolved value and its source tier, like `config get`. With a tier flag, it reads only that tier. `--all-tiers` is accepted on reads, as on `get`.
- **`next-step auto`** without `<skill>` lists every `next_step.auto.*` key that is set (see [Output](#output)). Any well-formed `<skill>` name is accepted, per the registry's [wildcard-matching rule](key-registry.md#wildcard-matching).
- **Flags.** Shortcuts accept the tier flags, the [global flags](command-surface.md#global-flags), and `--lock-timeout` on writes. They do **not** accept `--force` or `--string`: shortcuts only target known keys with known types. Unknown or experimental keys go through generic `config set --force`.
- **Validation** is the generic layer's. Enum values (`engine`, `git merge-body`) are checked against the registry, and failures use the same exit codes and error wording as `config set` (see [Command Surface](command-surface.md#exit-codes)).
- **Tuning knobs** such as `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` get no shortcut. They stay reachable through generic `config set`.

### Output

Single-value shortcuts reuse the generic layer's output contract (see [Output](command-surface.md#output) and [JSON output](command-surface.md#json-output)) rather than defining their own.

- **Same output as the generic command.** A shortcut prints exactly what its generic equivalent prints, in human and `--json` modes, with the same exit codes:

  | Shortcut | Same as |
  | --- | --- |
  | `engine` | `config get engine.mode` |
  | `engine native` | `config set engine.mode native --local` |
  | `engine --unset` | `config unset engine.mode --local` |
  | `next-step auto enhance-issue on` | `config set next_step.auto.enhance-issue true --local` |

  Booleans print as `true`/`false`, not `on`/`off`. This keeps one contract to test, and the JSON's `key` field already tells scripts which key was touched.
- **Unset in every tier.** The read exits `1`, like `config get`. The human line shows the registry default when there is one, and the JSON carries the additive `"default"` field, as `get` does:

  ```text
  $ arcanum config git safe-branch
  (unset; default: origin/main)
  ```

  ```json
  {"key": "git.safe_branch", "set": false, "value": null, "source": null, "default": "origin/main"}
  ```

  `default` is `null` when the registry has none.
- **`next-step auto` without `<skill>`** (the listing form) prints one line per set key in human mode, as `<skill>  <true|false>  (<tier>)`. It shows resolved values only, sorted by skill, and exits `0`, even when the list is empty.

  ```text
  $ arcanum config next-step auto
  auto-plan-issue  false  (local)
  enhance-issue    true   (global)
  ```

  ```json
  {"entries": [
    {"key": "next_step.auto.auto-plan-issue", "value": false, "source": "local"},
    {"key": "next_step.auto.enhance-issue", "value": true, "source": "global"}
  ]}
  ```

- The output of `agents email` and `ignore-checks` is defined in their own sections below.

### `agents email`

#### Resolution

Resolution matches `arcanum/_lib/agent_email.sh` exactly, so the CLI shows what commits will actually use:

1. Tiers are tried in order: local, then repo, then global.
2. Within a tier, `git.agents.<agent>` is tried first, then `git.email`.
3. A tier is fully resolved before the next one is consulted. So a generic `git.email` at a higher tier beats a `git.agents.<agent>` at a lower tier.
4. A JSON `null` counts as absent.
5. `{agent}` in the resolved value is replaced by the agent's name.
6. An explicit `""` at the winning tier and key stops the chain and means "no email": the commit falls back to the model's email. The CLI shows `(model default)` together with where the empty value sits, e.g. `(empty at repo: git.agents.node)`.

The CLI implements this through `AgentEmail#resolve`, built on `ConfigChain#readWithSource`, the same helper the native commit commands use (see [Shared Config Logic → Shared agent-email helper](shared-config-logic.md#shared-agent-email-helper)), not by reimplementing it ad hoc. When no tier has a value, the commit falls back to the model's email, which the CLI cannot know: it shows `(model default)` and `source: null`.

#### Which agents are listed

The union of:

- every agent with a `git.agents.<agent>` entry in any tier;
- every agent defined in the target repo's `.claude/agents/*.md` (the file basename), when there is a repo.

Configured agents that are not in the repo are marked `(not in this repo)`. Outside a repo, only configured agents are listed. Rows are sorted by agent name.

#### Listing: `arcanum config agents email`

A `default` line shows the resolved raw `git.email`, with `{agent}` left unsubstituted, and its tier. Then one row per agent shows its effective email and the tier and key it came from. It exits `0`, even when nothing is configured.

```text
default  you+{agent}@example.com   (global: git.email)

agent      effective email              from
architect  you+architect@example.com    global git.email
node       node-bot@example.com         repo   git.agents.node
reviewer   rev@example.com              global git.agents.reviewer   (not in this repo)
```

```json
{
  "default": {"set": true, "value": "you+{agent}@example.com", "source": "global"},
  "agents": [
    {"agent": "architect", "email": "you+architect@example.com", "source": "global", "key": "git.email", "in_repo": true},
    {"agent": "node", "email": "node-bot@example.com", "source": "repo", "key": "git.agents.node", "in_repo": true},
    {"agent": "reviewer", "email": "rev@example.com", "source": "global", "key": "git.agents.reviewer", "in_repo": false}
  ]
}
```

- When the model default applies, `email`, `source` and `key` are `null`, and the human row shows `(model default)`.
- When the model default applies because of an explicit `""` (rule 6), `email` is `null` but `source` and `key` name the tier and key holding the empty value, and the human row shows e.g. `scripter   (model default)   (empty at repo: git.agents.scripter)`.
- Outside a repo, `in_repo` is `null` and no row is marked.

#### Detail: `arcanum config agents email <agent>`

Shows the per-tier breakdown of both keys for that agent, and marks which one is resolved and which are shadowed. It exits `1` when nothing resolves (the model default would apply), like `get`.

```text
local   git.agents.node  -
        git.email        -
repo    git.agents.node  node-bot@example.com      <- resolved
        git.email        -
global  git.agents.node  -
        git.email        you+{agent}@example.com   (shadowed)
```

```json
{
  "agent": "node",
  "resolved": {"email": "node-bot@example.com", "source": "repo", "key": "git.agents.node"},
  "tiers": {
    "local":  {"agents": {"set": false, "value": null}, "email": {"set": false, "value": null}, "file": "/x/foo/.claude/state/arcanum-config.json"},
    "repo":   {"agents": {"set": true, "value": "node-bot@example.com"}, "email": {"set": false, "value": null}, "file": "/x/foo/.claude/configuration/arcanum-repo-config.json"},
    "global": {"agents": {"set": false, "value": null}, "email": {"set": true, "value": "you+{agent}@example.com"}, "file": "/Users/x/.claude/arcanum-config.json"}
  }
}
```

- `"file": null` marks a tier with no target, as in `get --all-tiers`.
- When nothing resolves, every field of `resolved` is `null`.

#### Writes

- `set` and `unset` default to the `global` tier; a tier flag overrides it.
- Their output reuses `config set`/`config unset`'s contract (see [Output](#output)).
- `set` and `unset` are verbs in this position, so an agent literally named `set` or `unset` can only be read through generic `config get git.agents.<agent>`. Accepted as negligible.

### `ignore-checks`

At runtime, `auto-fix-all.ignored_check_patterns` is read **only from the repo tier**: `RepoConfig.getIgnoredCheckPatterns` (`core/lib/utils/config/RepoConfig.js`) reads `.claude/configuration/arcanum-repo-config.json`, with no chain. Its entries are **case-insensitive regex strings** (`core/lib/services/PrChecker.js`), not globs. The shortcut follows both facts.

- **Repo tier only.** The registry marks the key repo-only. `--local` and `--global` on `ignore-checks`, and on generic `config set`/`unset` of this key, are a validation error (exit `3`, `arcanum: auto-fix-all.ignored_check_patterns is repo-only`). No cross-tier merge or shadowing question arises.
- **Syntax.**
  - `ignore-checks` or `ignore-checks list` lists the patterns;
  - `ignore-checks add <pattern>...` adds one or more patterns;
  - `ignore-checks remove <pattern>...` removes one or more patterns.

  `add` or `remove` with no pattern is a usage error (exit `2`). Use `--` before patterns that start with `-`.
- **Semantics.**
  - **Matching.** Patterns match by exact string. Two regexes that are equivalent but spelled differently are different patterns.
  - **`add`.** Appends in the order given and keeps the existing order. Adding a pattern that is already present is a no-op for that pattern.
  - **`remove`.** Removing a pattern that is not present is a no-op for that pattern.
  - **No-ops.** A call where nothing changed exits `0` with `"changed": false`, like `unset` of an unset key.
  - **Key absent.** Treated as `[]`. Removing the last pattern leaves `[]`; the key is not deleted. To delete it, use `config unset auto-fix-all.ignored_check_patterns --repo`.
  - **Not an array.** If the stored value is not an array (e.g. hand-edited), `add` and `remove` refuse with exit `3` and `hint: fix it with: arcanum config set auto-fix-all.ignored_check_patterns '[...]' --repo`. `list` prints the same error and exits `3`.
- **Validation.** Each pattern given to `add` must compile with `new RegExp(p, 'i')`, the same flags as `PrChecker`. An invalid regex is exit `3` with the parse error, and nothing is written, not even the other, valid patterns of the same call. Help text states that patterns are case-insensitive regexes, not globs. `remove` does not validate: it removes by exact string, so a stale invalid pattern can still be removed.
- **Atomicity.** `add` and `remove` are a read-modify-write done **inside** the lock: acquire, re-read, modify, write, release. Concurrent `add` calls therefore cannot lose updates. The [malformed-file](command-surface.md#missing-and-malformed-tier-files) and version-skew rules apply unchanged.
- **Output.**
  - **`list`, human:** one pattern per line, raw. With no patterns it prints nothing and exits `0`.
  - **`list`, JSON:** `{"key": "auto-fix-all.ignored_check_patterns", "tier": "repo", "file": "...", "patterns": ["^codacy"]}`.
  - **`add`/`remove`, human:** e.g. `added '^codacy' to auto-fix-all.ignored_check_patterns (repo: <file>)`, or `'^codacy' already present`.
  - **`add`/`remove`, JSON:** the `config set` shape, where `value` and `previous.value` are the whole arrays, plus two additive fields, `"added"` and `"removed"`, listing the patterns actually changed:

    ```json
    {"key": "auto-fix-all.ignored_check_patterns", "tier": "repo", "file": "/x/foo/.claude/configuration/arcanum-repo-config.json",
     "changed": true, "previous": {"set": true, "value": ["^sonar"]}, "value": ["^sonar", "^codacy"], "forced": false,
     "added": ["^codacy"], "removed": []}
    ```

- **Relation to `init-claude`.** `InitClaudeSetCiIgnoredPatterns` replaces the whole list; the shortcut edits it incrementally. Both write the same key and file through the same lock.

### `arcanum config setup` wizard

The wizard gives new users a guided path through the core onboarding settings: the things a new user must decide to get going. Operational toggles stay shortcut-only.

#### Coverage and order

Sections are asked in this order:

| # | Section | Keys |
| --- | --- | --- |
| 1 | `identity` | `git.email` (the default address or `{agent}` pattern). Then, optionally (default: skip), `git.agents.<agent>` overrides for each agent in the target repo's `.claude/agents/`. |
| 2 | `engine` | `engine.mode` |
| 3 | `git` | `git.safe_branch`, then `git.merge_body_mode` |
| 4 | `flow` | `next_step.auto.<skill>`: one yes/no per known skill that offers a next step. Today those are `enhance-issue`, `discuss-issue` and `auto-plan-issue` (per the root `README.md`). |
| 5 | `ci` | `auto-fix-all.ignored_check_patterns` (repo-only, see [`ignore-checks`](#ignore-checks)) |

**Not asked:** `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context`, the `plan-issues.*` tuning knobs, and the read-only version pointers.

#### Registry-driven

- Registry entries carry an optional `setup` field, `{section, order, prompt, instances?}` (see [Key Registry](key-registry.md#entry-shape)). The wizard asks exactly the entries that have it, ordered by section, then by `order`.
- A wildcard entry lists the concrete instances to ask in `setup.instances`, e.g. `["enhance-issue", "discuss-issue", "auto-plan-issue"]` for `next_step.auto.<skill>`.
- `git.agents.<agent>` is the exception: its instances come from the repo's `.claude/agents/*.md`.
- Adding a key to the wizard is then a registry edit, not CLI code. The section order above is the CLI's canonical list; a registry `section` outside it is a build-time error.

#### Sections and targets

- **Running a subset.** `arcanum config setup [<section>...]`, e.g. `arcanum config setup identity flow`. With no argument, the wizard runs all sections. Sections given as arguments still run in the canonical order, and duplicates are ignored. An unknown section is a usage error (exit `2`) that lists the valid ones.
- **Outside a repo.** Repo-dependent items are skipped with a one-line note: the per-agent overrides, every item whose default or only tier is `repo` or `local`, and so the whole `ci` section. Only global-tier items are offered.
- **Unconfigured repo.** The same rule applies, plus a hint to run `/init-claude`, matching the index's [Targeting](../arcanum-cli.md#targeting) rules.
- **Nothing left to ask.** If every requested section is skipped, the wizard prints the notes and exits `4` (`EXIT_TARGET_UNAVAILABLE`).

#### TTY requirement

- The CLI runs outside Claude, so there is no `AskUserQuestion` / `FALLBACK=chat` path.
- The wizard requires stdin **and** stderr to be TTYs. Prompts go to stderr, so stdout keeps carrying only results, per [Command Surface](command-surface.md#output).
- Without a TTY, the wizard exits `2` (`EXIT_USAGE`) with `arcanum: config setup needs an interactive terminal` and `hint: use arcanum config set / the shortcuts instead`.
- `--json` with `setup` is a usage error (exit `2`).

#### Per-setting flow

For each setting:

1. Show the key, its registry description, its current resolved value and its source tier.
2. Ask for the new value. Enter keeps the current one; `-` unsets the key at the chosen tier.
3. Ask for the target tier, offering only the tiers the registry allows for the key and defaulting to the shortcut's default tier. Single-tier keys (e.g. the repo-only `ci` key, the local-only `git.safe_branch`) skip this question.
4. Show the exact write and ask `[Y/n]`.
5. Write immediately, through the same code path as `config set`/`unset`, so the lock, skew, malformed-file and validation rules all apply.

If the user keeps the current value, nothing more is asked or written.

```text
engine.mode — Script engine mode (shell|native|docker)
  current: native (repo)
  new value [shell/native/docker, Enter keeps, - unsets]: shell
  tier [local/repo/global] (local):
  set engine.mode = "shell" at local (/x/foo/.claude/state/arcanum-config.json)? [Y/n]
```

- **Shadowing note.** When the chosen tier is shadowed by a higher-precedence tier that holds a value (e.g. writing global while local has one), the confirmation adds `note: local still overrides this (value: …)`.

#### Input handling

- **Invalid input.** A value that fails enum, type or regex validation re-prompts with the error, instead of exiting `3`.
- **Booleans.** They accept `y`/`n`, `on`/`off` and `true`/`false`, stored as JSON booleans.
- **Enums.** The choices are shown inline.
- **Arrays (`ci`).** The wizard shows the current list, then loops over `[a]dd / [r]emove / [d]one`. Each add or remove follows the [`ignore-checks`](#ignore-checks) rules and is confirmed and written like any other setting.
- **Identity section.** `git.email` is asked first. Per-agent overrides sit behind `customise per-agent emails? [y/N]`. When the answer is yes, the wizard asks once per repo agent, showing what the pattern resolves to for that agent.

#### Interrupts and errors

- **Ctrl-C.** It stops the wizard and exits `130`. Settings already written are kept: each write is atomic, and the lock is released by the signal handler.
- **EOF (Ctrl-D).** Treated like Ctrl-C.
- **Write errors.** A write error (lock timeout, skew, malformed file, I/O) prints the error, marks that setting failed and moves on to the next. The final exit code is the first error's code, or `0` when there were none.
- **Summary.** On every exit path, including Ctrl-C and EOF, the wizard prints a summary to stderr: written (key, tier, old → new), kept, failed (with reason) and not reached.

```text
summary
  written      engine.mode            local   native -> shell
  kept         git.safe_branch        local   origin/main
  failed       git.merge_body_mode    local   timed out waiting for lock
  not reached  next_step.auto.*, auto-fix-all.ignored_check_patterns
```

## Edge cases

- **Agent named `set` or `unset`.** Readable only through `config get git.agents.<agent>`; writable through `config set git.agents.<agent> ... --global`.
- **Patterns starting with `-`.** Pass `--` first: `arcanum config auto-fix-all ignore-checks add -- -flaky`. Without it, the token is parsed as an unknown flag (exit `2`).
- **Concurrent `ignore-checks add`.** Serialized by the lock; each call re-reads inside the lock, so both patterns end up in the file.
- **Hand-edited, non-array `ignored_check_patterns`.** `list`, `add` and `remove` refuse with exit `3` and the fix-it hint; nothing is written.
- **Positional value plus `--unset`.** Usage error (exit `2`).
- **Boolean token in another case (`ON`, `True`).** Exit `3` with the accepted tokens.
- **Writing to a shadowed tier.** Allowed. The shortcut prints the generic `set` output plus a stderr note naming the overriding tier; the wizard shows the same note before confirming.
- **`next-step auto <skill>` for a skill that does not exist.** Accepted: the CLI cannot reliably know arcanum's skill list, so any well-formed name is valid (see [Key Registry](key-registry.md#wildcard-matching)).
- **`git safe-branch --repo` or `--global`.** Exit `3`: the registry marks `git.safe_branch` local-only, because `safe_branch.sh` reads only the local tier.
- **`agents email` with an agents folder entry that is not a `.md` file.** Ignored.
- **`agents email` outside a repo.** Only configured agents are listed; the local and repo tiers show `"file": null`.
- **Wizard with no repo.** Global-tier items only; `ci` and per-agent overrides are skipped with a note.
- **Lock timeout during the wizard.** That setting is marked failed with exit-`6` wording; the wizard continues and exits `6` at the end unless an earlier error set another code.
- **Ctrl-C at a prompt versus during a write.** At a prompt, nothing is pending and the wizard exits `130`. During a write, the signal handler lets the atomic file replace finish or not happen at all, releases the lock and then exits `130`; the summary reports that setting as written or not reached accordingly.
- **Terminal resized or stdin closed mid-prompt.** Closing stdin is EOF; resizing has no effect.

## Backward compatibility

- No config shape change. The shortcuts and the wizard write the same keys, in the same files, that the skills read.
- `ignore-checks` stays repo-only, which matches the runtime: `RepoConfig.getIgnoredCheckPatterns` reads only the repo tier.
- Booleans are stored as JSON booleans, which is what `BooleanKeyConfig` and the `next_step.auto.*` rule expect.
- The shortcuts' output and JSON shapes are a public contract from the first release, like the generic layer's. They reuse the generic shapes, so a change to one is a change to both. Adding fields is minor; renaming or removing them is major.
- `InitClaudeSetCiIgnoredPatterns` keeps replacing the whole list; it and the shortcut share the lock.

## Testing

- Specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos, as in [Command Surface](command-surface.md#testing).
- One spec per shortcut form (read, set, `--unset`, tier override) asserting its output and JSON are byte-identical to the generic equivalent, including the unset read with and without a registry `default`.
- `next-step auto` listing specs: empty, mixed tiers, a `false` shadowing a `true`.
- Boolean token specs: each accepted token, an uppercase token, a non-boolean token.
- `ignore-checks` specs: add one and many, duplicate add, remove missing, remove the last pattern, absent key, non-array value, invalid regex in a multi-pattern call (nothing written), patterns after `--`, `--local`/`--global` refused, and `added`/`removed` fields.
- A concurrency spec running two `add` calls against a pre-held lock, asserting both patterns are kept.
- `agents email` resolution specs that mirror `agent_email.sh`'s cases, including the cross-tier precedence where a higher-tier `git.email` beats a lower-tier `git.agents.<agent>`, JSON `null` as absent, `{agent}` substitution, the model default, and an explicit `""` falling back to the model default (rule 6). The fixture table is the same one used by the shell/native parity specs of `AgentEmail` (see [Shared Config Logic](shared-config-logic.md#shared-agent-email-helper)); it runs both `agent_email.sh` and the CLI and asserts they agree.
- `agents email` listing specs: in a repo, outside a repo, a configured agent not in the repo.
- Wizard specs that drive a pseudo-TTY, covering: keep, set, unset with `-`, an invalid value then re-prompt, the tier prompt, the shadowing note, the `ci` add/remove loop, the per-agent opt-in, Ctrl-C mid-run, EOF, a write failure followed by a later success, no TTY, `--json`, no repo, an unknown section, and the summary in each case.

## Performance

Nothing load-sensitive. Shortcuts cost the same as their generic equivalents. `agents email` adds one `readdir` of `.claude/agents/`. The wizard does one write, and so one lock, per confirmed setting; it holds no lock while waiting for input.

## Security

- Every write goes through the generic layer, so its guarantees apply unchanged: no overwrite of an unparseable file, no writes outside the tier files, no shell interpolation (see [Command Surface](command-surface.md#security)).
- `ignore-checks` patterns are compiled with `new RegExp` for validation but never run against anything during validation. A pathological regex can only slow the later `PrChecker` match, as a hand-edited one can today.
- The wizard writes only after an explicit confirmation, and never while waiting at a prompt.
- No value is echoed back beyond what the user typed or what is already stored in the user's own config files.

## Alternatives considered

- **`git email` instead of `agents email`.** Rejected: the setting is about the agents, and `agents` leaves room for more per-agent settings.
- **Leaving `monitor-issues.clear_context` out of the CLI**, because it lives in its own file. Rejected in favour of consolidating it into the three-tier config first (#776), so the CLI only deals with the three tier files.
- **Leaving the wizard out of scope.** Rejected: it gives new users a guided path through the common settings.
- **Verbs (`show`/`set`/`unset`) on every shortcut.** Rejected: positional values read better, and verbs collide with values (e.g. a ref named `unset`).
- **Unsetting via `off`.** Rejected: `off` must be able to shadow a lower-tier `on`, which needs a stored `false`.
- **A separate, shortcut-specific output contract.** Rejected: two contracts to test and keep in sync, for no gain.
- **Listing only configured agents in `agents email`.** Rejected: the main question is what each repo agent will commit as, including agents with no override.
- **Allowing every tier, or merging arrays across tiers, for `ignore-checks`.** Rejected: the runtime reads only the repo tier, so other tiers would be silently ignored.
- **Collecting every wizard answer and writing at the end.** Rejected: Ctrl-C would lose everything, and a late write error would hide which settings applied.
- **A hardcoded wizard key list in the CLI.** Rejected: it drifts from the registry; a `setup` field keeps both in one place.

## Open points

None owned by the registry: whether `<skill>` must name an existing skill is decided in [Key Registry → Wildcard matching](key-registry.md#wildcard-matching), and the final `setup` / `instances` assignments in [Key Registry → Seed keys](key-registry.md#seed-keys).
