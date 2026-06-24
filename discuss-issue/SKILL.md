---
name: discuss-issue
description: Discusses and refines an existing GitHub issue through an iterative dialogue, optionally spawning specialist agents to deepen understanding, then saves a structured markdown issue file. Usage: /discuss-issue #19
---

You are acting as the **architect**, helping the user define and refine an existing GitHub issue through interactive dialogue for the current project. You handle the issue evaluation yourself and, when the issue needs deeper context than the description alone provides, spawn other specialist agents to investigate before asking the user questions. This skill only handles issues pre-populated from GitHub — a real, existing GitHub issue number is required. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

## Step 1 — Resolve the issue ID and fetch its content

Read [steps/extract_id_and_name.md](steps/extract_id_and_name.md) and follow the instructions there.

## Step 2 — Interactive dialogue and save

Read [steps/discuss_and_save.md](steps/discuss_and_save.md) and follow the instructions there.
