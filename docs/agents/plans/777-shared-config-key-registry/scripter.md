# Scripter Plan: Shared config key registry

Main plan: [plan.md](plan.md)

## Shared contracts

- Annotation format, exactly as in [plan.md](plan.md#shared-contracts): one or more consecutive `# config-key: <dotted.key>` lines directly above the call, using the registry's `<name>` wildcard syntax, each matching a registry key.
- Valid keys are the table in plan.md.

## Implementation Steps

### Step 1 — Annotate unparseable shell config calls
Add `# config-key:` annotations above every config helper call whose namespace, or whole key argument, is a variable:

- `auto-fix-all/scripts/config_get_shell.sh`, `config_set_shell.sh`, `config_toggle_shell.sh` and `config_is_enabled_shell.sh`. Their `$NAMESPACE` / `$KEY` cover the `auto-fix-all.*` keys those scripts accept. List each of `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue` and `auto-fix-all.ignored_check_patterns` that the script can actually reach.
- `init-claude/scripts/set_ci_ignored_patterns_shell.sh` → `auto-fix-all.ignored_check_patterns`.
- `arcanum/migrations/repos/2.0.0/001.sh`, `002.sh`, `003.sh` → `next_step.auto.<skill>`.

Scan for any other call whose namespace or whole key argument is a variable and annotate it too. Comments only, with no behaviour change.

### Step 2 — Docs rule in the scripter agent doc
Add to `.claude/agents/scripter.md` the convention: "adding a config key means adding a `core/lib/utils/config/keys.json` entry". A shell config call whose key can't be read statically needs a `# config-key: <key>` annotation on the line above.

## Files to Change
- `auto-fix-all/scripts/config_{get,set,toggle,is_enabled}_shell.sh` — annotations.
- `init-claude/scripts/set_ci_ignored_patterns_shell.sh` — annotation.
- `arcanum/migrations/repos/2.0.0/00{1,2,3}.sh` — annotations.
- `.claude/agents/scripter.md` — convention bullet (coordinate with architect if that file is architect-owned).

## CI Checks
- shell specs/lint as configured in `.circleci/config.yml` for the touched scripts; the node scan spec (`cd core && yarn test`) must pass with these annotations.

## Notes
- Comment-only changes; parity and behaviour are unaffected.
