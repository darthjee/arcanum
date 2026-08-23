---
name: init-claude
description: Configures CLAUDE.md and .github/copilot-instructions.md for a project, creating or updating them to point to a shared AGENTS.md file. Handles multiple scenarios depending on which files already exist. Usage: /init-claude
---

You are helping the user initialize or update the Claude and Copilot configuration files for the current project.

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to any step below that needs it (currently Step 9, [setup_auto_fix_all_settings.md](setup_auto_fix_all_settings.md), and Step 10, [setup_labels.md](setup_labels.md)).

## Step 1 — Setup PR and commit message templates

Read and follow [setup_templates.md](setup_templates.md).

## Step 2 — Detect existing files

Check which of these files exist in the current working directory:
- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`

## Step 3 — Select scenario and follow it

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

## Step 4 — Setup documentation structure

After the scenario completes successfully, read and follow [setup_docs_structure.md](setup_docs_structure.md).

## Step 5 — Setup folder structure document

After the documentation structure is created, read and follow [setup_folder_structure.md](setup_folder_structure.md).

## Step 6 — Setup architecture document

After the folder structure document is created, read and follow [setup_architecture.md](setup_architecture.md).

## Step 7 — Setup contributing guide

After the architecture document is created, read and follow [setup_contributing.md](setup_contributing.md).

## Step 8 — Setup agents

After the contributing guide is created, read and follow [setup_agents.md](setup_agents.md).

## Step 9 — Setup `auto-fix-all` settings

After the agents are set up, read and follow [setup_auto_fix_all_settings.md](setup_auto_fix_all_settings.md).

## Step 10 — Setup repository labels

After the `auto-fix-all` settings are set up, read and follow [setup_labels.md](setup_labels.md).

## Step 11 — Setup the `shipit`-merge permission exemption

After the repository labels are set up, read and follow [setup_permissions.md](setup_permissions.md).

## Step 12 — Setup issue enhancement concerns

After the `shipit`-merge permission exemption is set up, read and follow [setup_issue_enhancement.md](setup_issue_enhancement.md).

## Step 13 — Setup arcanum-split-issue concerns

After the issue enhancement concerns are set up, read and follow [setup_arcanum_split_issue.md](setup_arcanum_split_issue.md).

## Step 14 — Stamp the arcanum version

After the arcanum-split-issue concerns are set up, read and follow [setup_arcanum_version.md](setup_arcanum_version.md).
