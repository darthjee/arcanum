# Write shortcuts-and-setup.md

Create `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`, restating #767's shortcut list, design rules and wizard decision.

Decisions to capture:

- Shortcut set (all under `arcanum config`), with default tiers:
  - `agents email [set|unset] [<agent>] [<email|pattern>]` → `git.email` / `git.agents.<agent>` (global)
  - `engine [shell|native|docker]` → `engine.mode` (local)
  - `next-step auto <skill> [on|off]` → `next_step.auto.<skill>` (local)
  - `git safe-branch [<ref>]` → `git.safe_branch` (local)
  - `git merge-body [full|empty|coauthors]` → `git.merge_body_mode` (local)
  - `auto-fix-all clear-context [on|off]`, `auto-fix-all finish-on-empty-queue [on|off]` (local)
  - `auto-fix-all ignore-checks [list|add|remove] [<pattern>]` → `auto-fix-all.ignored_check_patterns` (repo)
  - `monitor-issues clear-context [on|off]` → `monitor-issues.clear_context` (local; available after the consolidation sub-issue #776)
- Design rules: thin front-ends over registry entries; no behaviour beyond generic `get/set` except array add/remove; namespaces mirror config namespaces; `agents email` kept under `agents`; no value ⇒ show current value + source tier; tier flags override defaults; tuning knobs (`plan-issues.*`) get no shortcut.
- `arcanum config setup` wizard (in scope): TTY walk-through of common settings driven by the registry, showing current value + source tier, asking new value + target tier, confirming before writing; no TTY ⇒ clear error pointing at non-interactive commands (no `AskUserQuestion` fallback — runs outside Claude).

Alternatives considered: `git email` instead of `agents email`; leaving `monitor-issues.clear_context` out of the CLI (rejected in favour of consolidating it into the three-tier config, #776); wizard out of scope.

Open points: exact output of each shortcut; which settings the wizard covers and in what order; wizard behaviour on partial completion / Ctrl-C.

## Files to Change
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` — new part.
