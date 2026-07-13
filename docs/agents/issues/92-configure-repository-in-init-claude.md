# Issue: Configure repository in init claude

## Description
Add a new, final step to the `init-claude` skill that ensures the repository has a standard set of GitHub issue labels (with the expected colors), syncing them via the GitHub API (`gh`).

## Problem
Other Arcanum skills (`monitor-issues`, `auto-fix-all`, `discuss-issue`, etc.) rely on GitHub labels such as `shipit`, `Enqueued`, `Working`, `Ready`, `Created` for automation and workflow signaling. `init-claude` does not currently ensure these labels exist in a newly initialized repository, or that their colors are consistent, so a repo can be missing labels the automation depends on.

## Expected Behavior
- `init-claude` gains a new final step (after "Setup CI monitoring options") that ensures a table of labels/colors exists in the repository.
- The default label table:

  | Label | Color |
  | -------- | -------- |
  | Bug | #b60205 |
  | Documentation | #0075ca |
  | Enqueued | #e8e639 |
  | Feature | #e9a20f |
  | Ready | #247b61 |
  | Refactor | #983e7f |
  | shipit | #0e8a16 |
  | Created | #024fa5 |
  | Working | #c314d7 |

- A script prints this table to the user and prompts directly for confirmation (accepting `y`, `n`, `yes`, `no`, case-insensitive) — this step's script does its own interactive stdin prompting rather than delegating the Q&A to the agent, unlike most other scripts in this repo.
  - Yes: the script proceeds to sync the labels to GitHub itself, creating any label that doesn't exist yet and updating the color of any label that already exists.
  - No: the script exits back to the agent without syncing. The agent then asks the user whether they want to (a) change the label list, entering the add/remove/update/replace refinement loop below, or (b) skip label syncing entirely for this run.
- If the user chooses to refine the list: the agent shows the current table (Label, Color; `null` for any label without a defined color yet) and loops, letting the user add a label (with or without stating a color), remove one, update a color, replace one or more entries, or replace the whole table (colors optional at that point) until the user says they are satisfied. The agent then re-invokes the script with the updated table.
- Nothing about the confirmed table is persisted locally (no `.claude/configuration/*.json` for this) — each `init-claude` run starts from the hardcoded default table and performs a live, one-shot sync to GitHub.

## Solution
- New step file `init-claude/setup_labels.md`, wired in as Step 10 of `init-claude/SKILL.md`.
- A script (e.g. `init-claude/scripts/sync_labels.sh`) receives the label/color pairs as arguments, prints the table, and interactively reads the y/n/yes/no confirmation from the user itself.
  - On confirmation, it uses `gh label create` / `gh label edit` (resolving the repo the same way other scripts in this repo do, from `git remote get-url origin`) to create missing labels or update the color of existing ones, then reports success back to the agent.
  - On rejection, it exits with a status the agent recognizes as "needs more discussion," without contacting GitHub.
- The step file drives the refinement loop (add/remove/update/replace) between script invocations, and handles the "no" ambiguity by asking the user whether to edit the list or skip syncing for this run.

## Benefits
- Newly initialized repositories automatically get the GitHub labels the Arcanum automation skills depend on, with consistent colors, without manual setup.
- Keeps label colors consistent across repositories using Arcanum.
