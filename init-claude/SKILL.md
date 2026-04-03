---
name: init-claude
description: Configures CLAUDE.md and .github/copilot-instructions.md for a project, creating or updating them to point to a shared AGENTS.md file. Handles multiple scenarios depending on which files already exist. Usage: /init-claude
---

You are helping the user initialize or update the Claude and Copilot configuration files for the current project.

## Step 1 — Detect existing files

Check which of these files exist in the current working directory:
- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`

## Step 2 — Select scenario and follow it

Based on what exists, read and follow the appropriate scenario file:

| AGENTS.md | CLAUDE.md | copilot-instructions.md | Scenario file        |
|-----------|-----------|-------------------------|----------------------|
| absent    | absent    | absent                  | [scenario_new.md](scenario_new.md) |
| absent    | present   | absent                  | [scenario_claude_only.md](scenario_claude_only.md) |
| absent    | absent    | present                 | [scenario_copilot_only.md](scenario_copilot_only.md) |
| present   | absent    | absent                  | [scenario_agents_only.md](scenario_agents_only.md) |
| absent    | present   | present                 | [scenario_both_no_agents.md](scenario_both_no_agents.md) |
| present   | present   | absent                  | [scenario_agents_claude.md](scenario_agents_claude.md) |
| present   | absent    | present                 | [scenario_agents_copilot.md](scenario_agents_copilot.md) |
| present   | present   | present                 | [scenario_all_present.md](scenario_all_present.md) |

If the detected scenario is marked as "not yet defined", inform the user:

```
This scenario is not yet implemented. Please open an issue or contribute a scenario file.
```

Then stop.
