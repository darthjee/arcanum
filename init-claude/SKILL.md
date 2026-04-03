---
name: init-claude
description: Configures CLAUDE.md and .github/copilot-instructions.md for a project, creating or updating them to point to a shared AGENTS.md file. Handles multiple scenarios depending on which files already exist. Usage: /init-claude
---

You are helping the user initialize or update the Claude and Copilot configuration files for the current project.

## Step 1 — Detect existing files

Check which of these files exist in the current working directory:
- `CLAUDE.md`
- `.github/copilot-instructions.md`

## Step 2 — Select scenario and follow it

Based on what exists, read and follow the appropriate scenario file:

| CLAUDE.md | copilot-instructions.md | Scenario file        |
|-----------|-------------------------|----------------------|
| absent    | absent                  | [scenario_new.md](scenario_new.md) |
| present   | absent                  | *(not yet defined)*  |
| absent    | present                 | *(not yet defined)*  |
| present   | present                 | *(not yet defined)*  |

If the detected scenario is marked as "not yet defined", inform the user:

```
This scenario is not yet implemented. Please open an issue or contribute a scenario file.
```

Then stop.
