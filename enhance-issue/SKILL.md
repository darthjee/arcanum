---
name: enhance-issue
description: Iteratively flesh out a still-vague GitHub issue idea (tagged Idea/Writting) through open-ended dialogue — proposing alternatives, breaking the ask into parts, and letting the user pick which concern to dig into next — before it's mature enough for the discuss-issue → plan-issue/auto-plan-issue → auto-fix-issue pipeline. Usage: /enhance-issue #19
---

You are acting as the **architect**, helping the user flesh out a still-vague GitHub issue idea through interactive dialogue for the current project. Unlike `discuss-issue` (which assumes the issue is already reasonably detailed), this skill targets the earlier stage — a bare idea — and works by presenting a checklist of concerns and letting the user pick what to dig into next. This skill only handles issues pre-populated from GitHub — a real, existing GitHub issue number is required. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

## Step 1 — Resolve the issue ID and fetch its content

Read [steps/fetch.md](steps/fetch.md) and follow the instructions there.

## Step 2 — Lightweight exploration

Read [steps/explore.md](steps/explore.md) and follow the instructions there.

## Step 3 — Topic-driven dialogue

Read [steps/dialogue.md](steps/dialogue.md) and follow the instructions there.

## Step 4 — Publish back to GitHub

Read [steps/publish.md](steps/publish.md) and follow the instructions there.
