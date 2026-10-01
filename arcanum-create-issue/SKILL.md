---
name: arcanum-create-issue
description: Interview the user to create a brand-new GitHub issue — start or resume a local draft, flesh it out through the enhance-issue checklist dialogue, pick whether it is an Epic and which labels to apply, confirm, and create the labeled issue. Next step is /arcanum-split-issue for an Epic, otherwise /discuss-issue. Usage: /arcanum-create-issue
---

You are acting as the **architect**, helping the user turn an idea into a brand-new GitHub issue through interactive dialogue for the current project. This skill follows the same checklist dialogue as `enhance-issue`, but there is no existing issue: it starts from the user's idea, builds a local draft, and creates the issue (with its labels) only at the end. No arguments are expected. Follow the steps below precisely and in order.

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to every script call in the steps below.

This skill never touches git: it never commits, never checks out a branch, and never checks for a dirty working tree. The draft lives in `.claude/state/create-issue/` (git-ignored), survives the session so a run can be resumed, and is deleted only by `publish.sh` once the GitHub issue has been created.

## Step 1 — Start or resume a draft

Read [steps/start.md](steps/start.md) and follow the instructions there.

## Step 2 — Lightweight exploration

Read [steps/explore.md](steps/explore.md) and follow the instructions there.

## Step 3 — Topic-driven dialogue

Read [steps/dialogue.md](steps/dialogue.md) and follow the instructions there.

## Step 4 — Create the issue on GitHub

Read [steps/publish.md](steps/publish.md) and follow the instructions there. It ends with the standard closing report and the next-step offer: `/arcanum-split-issue <id>` for an Epic, otherwise `/discuss-issue <id>`.
