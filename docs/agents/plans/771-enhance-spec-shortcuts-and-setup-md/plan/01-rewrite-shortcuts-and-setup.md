# Rewrite shortcuts-and-setup.md

Turn the spec into a complete contract, following `command-surface.md`'s structure. Fold in every decision from the issue's "Solution" subsections.

## Shortcut set

- **Syntax block.**
  - Single-value shortcuts take a positional value and gain `--unset`.
  - Add the `agents email <agent>` read form.
  - `ignore-checks` becomes `[list|add <pattern>...|remove <pattern>...]`.
  - `config setup` takes `[<section>...]`.
- **Table.**
  - `ignore-checks`'s default tier becomes "repo (only)".
  - Every `'codacy*'` example becomes `'^codacy'`.

## Design rules

Add:

- the two shapes of shortcut (single-value and verb);
- the `--unset` semantics;
- `agents email unset` with and without an agent;
- the boolean tokens (`on`/`off`/`true`/`false`, always stored as JSON booleans);
- `off` writes JSON `false`;
- reads ignore the default tier;
- `next-step auto` with no skill lists the keys that are set;
- accepted flags: tier, global and `--lock-timeout` on writes, but no `--force` or `--string`;
- validation is the generic layer's.

## New sections

- **"Output".**
  - Shortcuts produce the same output as `get`/`set`/`unset`, in human and JSON modes, with the same exit codes.
  - An unset read exits `1`, shows `(unset; default: …)`, and its JSON carries the `default` field.
  - Define the human and JSON shapes of the `next-step auto` listing.
- **"`agents email`".**
  - The resolution algorithm, identical to `arcanum/_lib/agent_email.sh`.
  - `(model default)` when nothing resolves.
  - The agents listed: configured agents plus `.claude/agents/*.md`, with the `(not in this repo)` marker.
  - The human examples for the listing and the per-agent detail.
  - Both JSON shapes.
  - Exit codes: `0` for the listing; `1` for the detail when nothing resolves.
  - The reserved `set`/`unset` names.
  - Writes default to the global tier.
- **"`ignore-checks`".**
  - Repo-only, refused with exit `3` for other tiers.
  - Exact-string matching; idempotent `add` and `remove` that exit `0` with `changed: false`.
  - Keeps the existing order, and accepts several patterns per call.
  - An absent key counts as `[]`, and the last `remove` leaves `[]`.
  - A stored value that is not an array is exit `3`.
  - Regex validation with `new RegExp(p, 'i')`, all-or-nothing per call.
  - Read-modify-write inside the lock.
  - The `list`, `add` and `remove` output, including the `added`/`removed` JSON fields.
  - Its relation to `InitClaudeSetCiIgnoredPatterns`.

## Rewrite "`arcanum config setup` wizard"

- **Coverage and order.** Sections are `identity`, `engine`, `git`, `flow` and `ci`; list what is not asked.
- **Registry-driven.** Entries carry a `setup` field, plus `instances` for wildcard keys; the `git.agents.<agent>` instances come from the repo.
- **Sections.** Running only the named sections; behaviour outside a repo or in an unconfigured repo.
- **TTY.** stdin and stderr must be TTYs, otherwise exit `2` with a hint. `--json` is a usage error.
- **Per-setting flow.**
  - Enter keeps the current value; `-` unsets the key.
  - The tier prompt offers only the allowed tiers, with the default pre-selected.
  - `[Y/n]` confirmation, then an immediate write through the `set` path.
  - A shadowing note when a higher-precedence tier still holds a value.
- **Input handling.** Re-prompt on invalid input. The `y`/`n`, `on`/`off` and `true`/`false` tokens. Enums shown inline. The array add / remove / done loop. The opt-in per-agent overrides.
- **Interrupts and errors.**
  - Ctrl-C and EOF exit `130` and keep the writes already made.
  - A write error marks that setting failed and continues; the wizard exits with the first error's code.
  - A summary is printed on every exit path.

## Other sections

- **Add "Edge cases":**
  - an agent named `set`/`unset`;
  - patterns starting with `-` (pass `--`);
  - concurrent `ignore-checks add`;
  - a hand-edited, non-array value;
  - writing to a shadowed tier;
  - a wizard run with no repo;
  - a lock timeout during the wizard;
  - Ctrl-C at a prompt versus during a write.
- **Add "Backward compatibility":** no config shape change. The shortcuts write the same keys the skills read. `ignore-checks` stays repo-only, which matches the runtime. The JSON shapes are a public contract, like the generic layer's.
- **Add "Testing":** one spec for each shortcut form and each output shape; idempotency and regex specs for `ignore-checks`; `agents email` resolution specs that mirror `agent_email.sh` cases, including the counter-intuitive cross-tier precedence; and wizard specs that drive a pseudo-TTY, covering keep, unset, an invalid value then re-prompt, Ctrl-C mid-run, EOF, write failure, no TTY and no repo.
- **Add "Performance":** this is not load-sensitive. `agents email` adds one `readdir` of `.claude/agents/`.
- **Add "Security":** reuse the generic layer's guarantees. Patterns are compiled but never executed against anything during validation. The wizard writes only after confirmation. No value is echoed back beyond what the user typed.
- **"Alternatives considered":** keep the existing entries and add the alternatives rejected in the issue:
  - verbs on every shortcut;
  - unsetting via `off`;
  - a separate shortcut-specific output contract;
  - listing only configured agents;
  - all tiers or merged arrays for `ignore-checks`;
  - collecting every answer and writing at the end;
  - a hardcoded wizard key list.
- **"Open points":** remove the four resolved ones. Keep only what is still genuinely open, for example whether `next-step auto`'s `<skill>` is validated (owned by #777); or "None" otherwise.

## Files to Change
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` — full rewrite per the above.
