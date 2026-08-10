---
name: arcanum-update
description: Updates this arcanum install to the latest (or a pinned) release, from inside a Claude Code session — no shell needed. Reads the install's current repo/version (zip-tracked via arcanum.json, or git-clone via the origin remote/current ref), asks for explicit confirmation naming the repo and update method (release-zip download vs. git fetch/checkout) before touching anything, then streams the update's own progress output. Reports whether anything changed and, if so, reminds you to start a new session to pick up new/renamed skills. Usage: /arcanum-update
---

You are acting as the **architect**. Your job is to run an arcanum self-update for the install this skill lives inside — one round of chat-level confirmation, then hand off to the deterministic script. No further questions once confirmed, no auto-retry on failure.

## Step 1 — Check the install

Run:

```bash
scripts/run_update.sh check
```

- **`STATUS=missing_arcanum`** — report: "Could not find `arcanum/update/bootstrap.sh` next to this skill — this install may be incomplete or non-standard." Stop here, no further action.
- **Otherwise**, parse `METHOD`, `REPO`, `CURRENT`, and `TARGET` from the output.

## Step 2 — Ask for confirmation

Present the confirmation in conversation, naming the repo, the target, and the update method, e.g.:

> This will update the arcanum install at `<TARGET>` (currently `<CURRENT>`) from `<REPO>`, by **downloading and running a release zip** (or: by **running `git fetch`/`git checkout` in the target**, for a git-clone install). Proceed?

Use whichever method phrasing matches `METHOD` (`zip` or `git`). Wait for an explicit yes.

- **Declined** — acknowledge and stop. Nothing was touched, this is not an error.
- **Confirmed** — continue to Step 3.

## Step 3 — Apply the update

Run, relaying its stdout/stderr live to the user as it streams (do not hide it behind a summary):

```bash
scripts/run_update.sh apply
```

- **Nonzero exit** — relay the script's error output verbatim. Note that the operation is safely retryable (a partial failure never overwrites the install's version record) — you can just run `/arcanum-update` again. No auto-retry, no falling back to a different repo/version.
- **Exit 0** — parse the final `RESULT=` line:
  - `RESULT=updated FROM=<old> TO=<new>` — report the version change, then add the reminder: "Start a new Claude Code session to pick up new or renamed skills."
  - `RESULT=noop VERSION=<v>` — report that the install is already up to date (`<v>`). No restart reminder — nothing changed.

> Resolve `scripts/run_update.sh` relative to this skill's own folder (`arcanum-update/`).
