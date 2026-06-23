# Architect Plan: Add Issue Monitoring Skill

Main plan: [plan.md](plan.md)

## Shared contracts

This agent writes the `SKILL.md` entry point. The invocation contract for the monitoring script is:
- Script: `scripts/monitor_issues.sh` (no arguments)
- Behavior: blocks indefinitely, logging actions to stdout as it processes issues
- The skill has no interactive steps — it is a pure background monitor

## Implementation Steps

### Step 1 — Create `monitor-issues/SKILL.md`

Create a new skill folder `monitor-issues/` with a `SKILL.md` that:

1. Has the required frontmatter:
   ```
   name: monitor-issues
   description: Starts a continuous background monitor that polls GitHub for issues created by the current user, writes parsed metadata and tags to a shared JSON state file, and respects the existing lock system. Usage: /monitor-issues
   ```
2. Describes what the skill does in one paragraph (no user interaction, runs forever).
3. Has a single step: run `scripts/monitor_issues.sh` and report that the monitor has started (it blocks, so this message never actually prints — note that in the SKILL.md).

The SKILL.md content:

```markdown
---
name: monitor-issues
description: Starts a continuous background monitor that polls GitHub for issues created by the current user, writes parsed metadata and tags to a shared JSON state file, and respects the existing lock system. Usage: /monitor-issues
---

You are acting as the **architect**. Your job is to start the issue monitoring loop — no user interaction, no confirmation.

## Step 1 — Start the monitor

Run the monitoring script:

\`\`\`bash
scripts/monitor_issues.sh
\`\`\`

This script runs forever (5-second sleep between rounds). It polls GitHub for issues created by the current user that have been created or updated since the last check, then writes parsed metadata (timestamps, tags) to `.claude/state/issues.json`, respecting the lock system. It does not take tag-based actions — that is out of scope for this skill.

The script never exits on its own. Stop it with Ctrl-C or by killing the process.
```

## Files to Change

- `monitor-issues/SKILL.md` — create new skill entry point

## Notes

- Do not create any auxiliary step files — the skill is simple enough for a single SKILL.md.
- The skill folder must be named exactly `monitor-issues` (matching the `name:` frontmatter field).
