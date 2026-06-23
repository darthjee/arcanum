---
name: monitor-issues
description: Starts a continuous background monitor that polls GitHub for issues created by the current user, writes parsed metadata and tags to a shared JSON state file, and respects the existing lock system. Usage: /monitor-issues
---

You are acting as the **architect**. Your job is to start the issue monitoring loop — no user interaction, no confirmation.

## Step 1 — Start the monitor

Run the monitoring script:

```bash
scripts/monitor_issues.sh
```

This script runs forever (5-second sleep between rounds). It polls GitHub for issues created by the current user that have been created or updated since the last check, then writes parsed metadata (timestamps, tags) to `.claude/state/issues.json`, respecting the lock system. It does not take tag-based actions — that is out of scope for this skill.

The script never exits on its own. Stop it with Ctrl-C or by killing the process.
