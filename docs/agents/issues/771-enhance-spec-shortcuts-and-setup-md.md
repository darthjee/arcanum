# Issue: Enhance spec: shortcuts-and-setup.md

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic for the full design decisions.

Deepen and review the spec file `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` written in the "Write the arcanum CLI spec" sub-issue.

Focus for this file: each shortcut's exact syntax, default tier and output; array add/remove for `ignore-checks`; the `config setup` wizard flow, prompts, confirmation, and no-TTY behaviour.

### Scope

- Resolve the open points recorded in this file.
- Cover, for what this file describes: edge cases, backward compatibility, testing strategy, performance & security considerations.
- Keep cross-links with the index and the other parts consistent; update the index's open-points list accordingly.
- Docs only — no code.

### Owner

`architect`.

### Dependencies

After "Write the arcanum CLI spec". Can run in parallel with the other "Enhance spec" sub-issues.

## Problem

`shortcuts-and-setup.md` leaves open:
- the exact output of each shortcut, in human and `--json` modes;
- which settings the wizard covers, and in what order;
- wizard behaviour on partial completion or Ctrl-C;
- how `agents email` displays the effective email per agent across tiers.

It also lacks edge cases, backward compatibility, testing, performance and security sections. While exploring, two more gaps turned up: the `ignore-checks` example treats patterns as globs, although they are case-insensitive regexes; and its tier can be overridden, although the runtime reads the key only from the repo tier.

## Expected Behavior

`shortcuts-and-setup.md` fully specifies every shortcut's syntax, default tier, output and JSON shape, the `ignore-checks` array semantics and the `config setup` wizard. It has no remaining open points from the list above, and it adds the standard edge-case, compatibility, testing, performance and security sections. `command-surface.md`, `key-registry.md`, `shared-config-logic.md` and the index are updated to stay consistent. Docs only, no code.

## Solution

Decisions reached while enhancing the issue. Fold them into `shortcuts-and-setup.md` and the cross-linked spec files listed under "Cross-link consistency".

### Shortcut syntax

Decisions to fold into the spec's "Shortcut set" and "Design rules":

- **Two shapes of shortcut.**
  - *Single-value shortcuts* (`engine`, `git safe-branch`, `git merge-body`, `next-step auto <skill>`, `auto-fix-all clear-context`, `auto-fix-all finish-on-empty-queue`, `monitor-issues clear-context`) take the value positionally: no value shows it, a value sets it.
  - *Verb shortcuts* stay only where needed: `agents email [set|unset]` (multi-key, `set <pattern>` vs `set <agent> <email>` distinguished by arity) and `auto-fix-all ignore-checks [list|add|remove]` (array).
- **Unset uses `--unset`** on single-value shortcuts, mirroring `git config --unset`: `arcanum config engine --unset [--repo]`. It writes to the shortcut's default tier unless a tier flag overrides it. `--unset` combined with a value is a usage error (exit `2`). The positional slot stays purely a value, so no reserved words collide with values (e.g. a ref named `unset`).
- **`agents email unset`** without an agent unsets `git.email`; with an agent, `git.agents.<agent>`.
- **Boolean toggles** accept `on`/`off` and `true`/`false` (lowercase only), always stored as JSON booleans, never strings, so `next_step.auto.*`'s "only JSON `true`" rule holds. Any other token is exit `3`, with a hint listing the accepted tokens.
- **`off` writes JSON `false`** at the target tier rather than removing the key, so it can shadow an `on` from a lower-precedence tier (e.g. turn off locally a global auto-advance). Removing the key is `--unset`.
- **Reads ignore the default tier.** Without a tier flag, a shortcut read shows the resolved value and its source tier, like `config get`. With a tier flag, it reads only that tier. `--all-tiers` is accepted on reads, as on `get`.
- **`next-step auto`** without `<skill>` lists every `next_step.auto.*` key that is set, with its resolved value and tier. Whether `<skill>` must name an existing skill follows the registry's wildcard-matching rule (key-registry open point, #777).
- **Flags.** Shortcuts accept the tier flags, the global flags and `--lock-timeout` on writes. They do **not** accept `--force` or `--string`: shortcuts only target known keys with known types. Unknown or experimental keys go through generic `config set --force`.
- **Validation** is the generic layer's: enum values (`engine`, `git merge-body`) are checked against the registry, and failures use the same exit codes and error wording as `config set`.

### Shortcut output

Single-value shortcuts reuse the generic layer's output contract (see `command-surface.md`, "Output" and "JSON output") rather than defining their own:

- **Same output as the generic command.** A shortcut prints exactly what its generic equivalent prints, in human and `--json` modes, with the same exit codes:
  - `engine` is the same as `config get engine.mode`;
  - `engine native` is the same as `config set engine.mode native --local`;
  - `engine --unset` is the same as `config unset engine.mode --local`.
  
  Booleans print as `true`/`false`, not `on`/`off`. This keeps one contract to test, and the JSON's `key` field already tells scripts which key was touched.
- **Unset in every tier.** The read exits `1`, like `config get`. The human line shows the registry default when there is one, e.g. `(unset; default: origin/main)`. The JSON gains an additive `"default"` field, `null` when the registry has none. This is allowed by command-surface's "new fields may be added" rule. The same `default` field should also be added to generic `get`'s JSON and human output, so the two stay identical. That means a small cross-file update to `command-surface.md`.
- **`next-step auto` without `<skill>`** (the listing form) prints one line per set key in human mode, as `<skill>  <true|false>  (<tier>)`. In `--json` mode it prints `{"entries": [{"key": "next_step.auto.<skill>", "value": <bool>, "source": "<tier>"}]}`, with resolved values only. It exits `0`, even when the list is empty.
- The output of `agents email` and `ignore-checks` is defined in their own sections.

### `agents email` display

- **Resolution matches `arcanum/_lib/agent_email.sh` exactly**, so the CLI shows what commits will actually use:
  - Tiers are tried in order: local, then repo, then global.
  - Within a tier, `git.agents.<agent>` is tried first, then `git.email`. A tier is fully resolved before the next one is consulted, so a generic `git.email` at a higher tier beats a `git.agents.<agent>` at a lower tier.
  - A JSON `null` counts as absent.
  - `{agent}` in the resolved value is replaced by the agent's name.
  
  The CLI implements this through the shared config logic, not by reimplementing it ad hoc. When no tier has a value, the commit falls back to the model's email, which the CLI cannot know: it shows `(model default)` and `source: null`.
- **Which agents are listed:** the union of:
  - every agent with a `git.agents.<agent>` entry in any tier;
  - every agent defined in the target repo's `.claude/agents/*.md` (the file basename), when there is a repo.
  
  Configured agents that are not in the repo are marked `(not in this repo)`. Outside a repo, only configured agents are listed. Rows are sorted by agent name.
- **`arcanum config agents email` (listing):**
  - a `default` line with the resolved raw `git.email`, `{agent}` left unsubstituted, and its tier;
  - then one row per agent, with its effective email and the tier and key it came from.
  
  It exits `0`, even when nothing is configured.

  ```text
  default  you+{agent}@example.com   (global: git.email)

  agent      effective email              from
  architect  you+architect@example.com    global git.email
  node       node-bot@example.com         repo   git.agents.node
  reviewer   rev@example.com              global git.agents.reviewer   (not in this repo)
  ```

- **`arcanum config agents email <agent>` (detail):** a new read form. It shows the per-tier breakdown of both keys for that agent, and marks which one is resolved and which are shadowed. It exits `1` when nothing resolves (the model default would apply), like `get`.

  ```text
  local   git.agents.node  -
          git.email        -
  repo    git.agents.node  node-bot@example.com      <- resolved
          git.email        -
  global  git.agents.node  -
          git.email        you+{agent}@example.com   (shadowed)
  ```

- **JSON.**
  - Listing: `{"default": {"set": bool, "value": str|null, "source": tier|null}, "agents": [{"agent": "node", "email": "node-bot@example.com", "source": "repo", "key": "git.agents.node", "in_repo": true}]}`. When the model default applies, `email`, `source` and `key` are `null`.
  - Detail: `{"agent": "node", "resolved": {"email": ..., "source": ..., "key": ...}, "tiers": {"local": {"agents": {"set": bool, "value": ...}, "email": {...}, "file": ...}, "repo": {...}, "global": {...}}}`. `"file": null` marks a tier with no target, as in `get --all-tiers`.
- **Reserved words.** `set` and `unset` are verbs in this position, so an agent literally named `set` or `unset` can only be read through generic `config get git.agents.<agent>`. Accepted as negligible.
- **Writes.** The default tier is `global`, and a tier flag overrides it. Output reuses `config set`/`config unset`'s contract (see "Shortcut output").

### `ignore-checks` add/remove

Context found while exploring: at runtime, `auto-fix-all.ignored_check_patterns` is read **only from the repo tier**: `RepoConfig.getIgnoredCheckPatterns` reads `.claude/configuration/arcanum-repo-config.json`, with no chain. Its entries are **case-insensitive regex strings** (`PrChecker`), not globs.

- **Repo tier only.** The registry marks the key repo-only. `--local` and `--global` on `ignore-checks` (and on generic `config set`/`unset` of this key) are a validation error (exit `3`, `arcanum: auto-fix-all.ignored_check_patterns is repo-only`). The spec table's "Default tier" for this shortcut becomes "repo (only)". No cross-tier merge or shadowing question arises.
- **Syntax:**
  - `ignore-checks` or `ignore-checks list` lists the patterns;
  - `ignore-checks add <pattern>...` adds one or more patterns;
  - `ignore-checks remove <pattern>...` removes one or more patterns.
  
  `add` or `remove` with no pattern is a usage error (exit `2`). Use `--` before patterns that start with `-`.
- **Semantics:**
  - **Matching.** Patterns match by exact string; two regexes that are equivalent but spelled differently are different patterns.
  - **`add`.** Appends in the order given and keeps the existing order. Adding a pattern that is already present is a no-op.
  - **`remove`.** Removing a pattern that is not present is a no-op.
  - **No-ops.** A call where nothing changed exits `0` with `"changed": false`, like `unset` of an unset key.
  - **Key absent.** It is treated as `[]`. `remove` of the last pattern leaves `[]` (no key deletion). To delete the key, use `config unset auto-fix-all.ignored_check_patterns --repo`.
  - **Not an array.** If the stored value is not an array (hand-edited), `add` and `remove` refuse with exit `3` and the hint `fix it with: arcanum config set auto-fix-all.ignored_check_patterns '[...]' --repo`.
- **Validation.** Each pattern given to `add` must compile with `new RegExp(p, 'i')`, the same flags as `PrChecker`. An invalid regex is exit `3` with the parse error, and nothing is written, not even the other, valid patterns in the same call. Help text states that patterns are case-insensitive regexes, not globs. The spec's example `'codacy*'` becomes `'^codacy'`.
- **Atomicity.** `add` and `remove` are read-modify-write done **inside** the lock: re-read, modify, write. This prevents concurrent `add` calls from losing updates. The malformed-file and version-skew rules from `command-surface.md` apply unchanged.
- **Output.**
  - **`list`, human:** one pattern per line, raw. With no patterns it prints nothing and exits `0`.
  - **`list`, JSON:** `{"key": "auto-fix-all.ignored_check_patterns", "tier": "repo", "file": ..., "patterns": [...]}`.
  - **`add`/`remove`, JSON:** the `config set` shape, where `value` and `previous.value` are the whole arrays. Two additive fields, `"added"` and `"removed"`, list the patterns actually changed.
  - **`add`/`remove`, human:** e.g. `added '^codacy' to auto-fix-all.ignored_check_patterns (repo: <file>)`, or `'^codacy' already present`.
- **Relation to `init-claude`.** `InitClaudeSetCiIgnoredPatterns` replaces the whole list; the shortcut edits it incrementally. Both write the same key and file through the same lock.

### Wizard coverage and order

- **Coverage.** The wizard covers the core onboarding set: the things a new user must decide to get going. Operational toggles stay shortcut-only. Sections are asked in this order:
  1. **`identity`**
     - `git.email`: the default address or `{agent}` pattern.
     - Then, optionally (default: skip), `git.agents.<agent>` overrides for each agent in the target repo's `.claude/agents/`.
  2. **`engine`**: `engine.mode`.
  3. **`git`**: `git.safe_branch`, then `git.merge_body_mode`.
  4. **`flow`**: `next_step.auto.<skill>`, one yes/no per known skill that offers a next step. Today those are `enhance-issue`, `discuss-issue` and `auto-plan-issue` (per the root `README.md`).
  5. **`ci`**: `auto-fix-all.ignored_check_patterns` (repo-only, see "`ignore-checks` add/remove").
- **Not asked:** `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context`, the `plan-issues.*` tuning knobs, and the read-only version pointers.
- **Registry-driven.** Registry entries carry an optional `setup` field, `{section, order, prompt}`. The wizard asks exactly the entries that have it, ordered by section, then by `order`. A wildcard entry (`next_step.auto.<skill>`) also lists the concrete instances to ask, e.g. `setup.instances: ["enhance-issue", "discuss-issue", "auto-plan-issue"]`. `git.agents.<agent>` is the exception: its instances come from the repo's `.claude/agents/*.md`. Adding a key to the wizard is then a registry edit, not CLI code. **Dependency:** the key registry issue (#777) must include the `setup` field and the `instances` list. Add this as a key-registry open point if #777 does not settle it.
- **Running a subset.** `arcanum config setup [<section>...]`, e.g. `arcanum config setup identity flow`. With no argument, the wizard runs all sections in the order above. Sections given as arguments still run in the canonical order. An unknown section is a usage error (exit `2`) that lists the valid ones.
- **Outside a repo.** Repo-dependent items are skipped with a one-line note: the per-agent overrides, every item whose default or only tier is `repo` or `local`, and the whole `ci` section. Only global-tier items are offered. In an unconfigured repo, the same rule applies, plus a hint to run `/init-claude`, matching the index's targeting rules.

### Wizard flow

- **TTY requirement** (resolves the "script-driven interaction" concern). The CLI runs outside Claude, so there is no `AskUserQuestion` / `FALLBACK=chat` path. The wizard requires stdin **and** stderr to be TTYs. Prompts go to stderr, so stdout keeps carrying only results, per `command-surface.md`. Without a TTY, the wizard exits `2` (`EXIT_USAGE`, as already listed in command-surface) with `arcanum: config setup needs an interactive terminal` and `hint: use arcanum config set / the shortcuts instead`. `--json` with `setup` is a usage error.
- **Per-setting flow.** For each setting:
  1. Show the key, its registry description, its current resolved value and its source tier.
  2. Ask for the new value. Enter keeps the current one; `-` unsets the key at the chosen tier.
  3. Ask for the target tier, offering only the tiers the registry allows for the key and defaulting to the shortcut's default tier. Repo-only keys skip this question.
  4. Show the exact write and ask `[Y/n]`.
  5. Write immediately, through the same code path as `config set`/`unset`, so the lock, skew, malformed-file and validation rules all apply.
  
  If the value is unchanged and the user keeps it, nothing is asked or written.
- **Shadowing warning.** When the chosen tier is shadowed by a higher-precedence tier that holds a value (e.g. writing global while local has one), the confirmation shows `note: local still overrides this (value: …)`.
- **Input handling.**
  - **Invalid input.** A value that fails enum, type or regex validation re-prompts with the error, instead of exiting `3`.
  - **Booleans.** They accept `y`/`n`, `on`/`off` and `true`/`false`.
  - **Enums.** The choices are shown inline.
  - **Arrays (`ci`).** The wizard shows the current list, then loops over `[a]dd / [r]emove / [d]one`. Each add or remove follows the "`ignore-checks` add/remove" rules and is confirmed and written like any other setting.
- **Identity section.** `git.email` is asked first. Per-agent overrides are behind `customise per-agent emails? [y/N]`; when the answer is yes, the wizard asks once per repo agent, showing what the pattern resolves to for that agent.
- **Interrupts and errors.**
  - **Ctrl-C.** It stops the wizard and exits `130`. Settings already written are kept (each write is atomic, and the lock is released by the signal handler).
  - **EOF (Ctrl-D).** Treated like Ctrl-C.
  - **Write errors.** A write error (lock timeout, skew, malformed file, I/O) prints the error, marks that setting failed and moves on to the next. The final exit code is the first error's code, or `0` when there were none.
- **Summary.** On every exit path, including Ctrl-C, the wizard prints a summary to stderr: written (key, tier, old → new), kept, failed (with reason) and not reached.

### New root-level folder?

No. This issue is docs-only and only edits files under `docs/agents/specs/arcanum-cli/` (plus the small `command-surface.md` cross-update noted above), all owned by `architect`. The root-level `cli/` folder the shortcuts and wizard will eventually live in is already assigned to the new `client` agent by the index's "Ownership" section (created in #775). The implementation work for shortcuts and wizard falls to `client`, with the registry `setup` field going through #777's owner.

### Cross-link consistency

The issue's scope bullet "update the index's open-points list" is moot: the index (`arcanum-cli.md`) no longer keeps a consolidated list ("each part keeps its own"). Instead, the following cross-file updates ship with this issue so the parts stay consistent:

- **`shortcuts-and-setup.md`** (the main deliverable):
  - Fold in every section above.
  - Fix the shortcut table: `ignore-checks` becomes "repo (only)", and `'codacy*'` becomes `'^codacy'`.
  - Add `agents email <agent>` and the `--unset` flag to the syntax block, and `[<section>...]` to `config setup`.
  - Remove the four resolved open points. Add new ones only for anything still undecided.
  - Add the Edge cases, Backward compatibility, Testing, Performance and Security sections, matching `command-surface.md`'s structure.
- **`command-surface.md`**:
  - Add the additive `"default"` field to `get`'s JSON (and the `(unset; default: …)` human form), so shortcuts and `get` stay identical.
  - Add an exit-`3` example for a wrong tier on a repo-only key (`auto-fix-all.ignored_check_patterns is repo-only`).
  - Note that `config setup` prompts go to stderr.
- **`key-registry.md`**:
  - Add the optional `setup: {section, order, prompt, instances}` field to the entry shape.
  - Mark `auto-fix-all.ignored_check_patterns` as **repo only**, with entries that are case-insensitive regexes validated by `new RegExp(p, 'i')`.
  - Note that registry defaults feed the shortcut and `get` `default` field.
  - Record the `setup` field as an input for #777.
- **`shared-config-logic.md`**: add an open point. `agents email` needs the per-tier, two-key agent email resolution, which today exists in `arcanum/_lib/agent_email.sh` and as private `_agentEmailGet` methods in `core/lib` commit commands (e.g. `AutoFixIssueCommitChange.js`). It should be extracted into one shared `core/lib` helper on the declared shared surface, so the CLI and commits cannot disagree. Owner: `node`.
- **Index `arcanum-cli.md`**: update the one-line summary of [Shortcuts and Setup] to mention `agents email` per-agent detail, `ignore-checks` add/remove, and the sectioned, registry-driven wizard. If the shared agent-email helper is accepted, add it to the "Pieces introduced" table (owner `node`).

### Notes for implementation

- **Migration needed?** No. This is a docs-only change with no config shape change.
- Edge cases, backward compatibility, the testing strategy, and performance and security were not discussed separately. Write them into the spec when implementing, following `command-surface.md`'s sections and building on the decisions above (e.g. lock re-read for `ignore-checks`, the TTY check, idempotent no-ops, and repo-only refusal).
