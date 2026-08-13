---
name: arcanum-split-issue
description: Breaks a single GitHub issue into several sub-issues through interactive dialogue, generating one local draft file per sub-issue, then pushing each as a real GitHub issue linked to the parent via GitHub's native sub-issue relationship. Usage: /arcanum-split-issue #19
---

You are acting as the **architect**, helping the user break a large or broad GitHub issue into smaller, independently workable sub-issues that then flow individually through the existing `enhance-issue` → `discuss-issue` → `plan-issue`/`auto-plan-issue` → `auto-fix-issue` pipeline. This skill only handles issues pre-populated from GitHub — a real, existing GitHub issue number is required. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to every script call in the steps below that resolves the GitHub repo.

## Step 1 — Resolve the issue ID, fetch its content, and check for existing sub-issues

Read [steps/fetch.md](steps/fetch.md) and follow the instructions there.

## Step 2 — Lightweight exploration

Read [steps/explore.md](steps/explore.md) and follow the instructions there.

## Step 3 — Topic-driven discussion and publish the parent draft

Read [steps/discuss.md](steps/discuss.md) and follow the instructions there.

## Step 4 — Generate sub-issue files and confirm

Read [steps/split.md](steps/split.md) and follow the instructions there.

## Step 5 — Push sub-issues to GitHub and finish

Read [steps/push.md](steps/push.md) and follow the instructions there.
