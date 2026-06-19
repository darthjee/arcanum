# Extract scripts for checks

## Context

When agents implement work through `auto-fix-all` (which calls `auto-fix-issue`), the development cycle includes a step where the specialist agent checks tests/lint after implementing changes. Today, the test/lint commands to run live only as prose inside each agent's own definition file (`.claude/agents/<agent>.md`), with no consistent, scriptable way to discover and run them. `init-claude` (which sets up agent definitions) has no mechanism to capture each agent's check command and turn it into something executable.

## What needs to be done

- Add a script (e.g. under `auto-fix-issue/scripts/`) that takes an agent name as its argument, looks for `.claude/scripts/check_<agent>.sh` in the target project, and executes it if found. If no such script exists for that agent, exit cleanly indicating "no tests needed" rather than erroring.
- Update `auto-fix-issue/steps/dispatch_agents.md` (and any other step that currently tells an agent to run "the commands documented in your own agent instructions") to instead call this new check script.
- Update the `init-claude` skill:
  - Move the agents-definition step (`init-claude/setup_agents.md`) to run after the other documentation-setup steps in `init-claude/SKILL.md` (confirm current ordering before changing it).
  - After defining each agent, ask the user what command(s) run that agent's tests/lint.
  - Generate a `.claude/scripts/check_<agent>.sh` script per agent that runs the provided command(s), in the target project being initialized.

## Acceptance criteria

- [ ] A script exists that, given an agent name, runs `.claude/scripts/check_<agent>.sh` if present, or cleanly reports "no tests needed" if absent.
- [ ] `auto-fix-issue`'s development cycle uses this script instead of relying on each agent's own prose-described check commands.
- [ ] `init-claude` asks, per agent, for its test/lint command(s) and generates the corresponding `.claude/scripts/check_<agent>.sh` in the initialized project.
- [ ] `init-claude/setup_agents.md`'s step runs after the other documentation-setup steps.

---
See issue for details: https://github.com/darthjee/arcanum/issues/9
