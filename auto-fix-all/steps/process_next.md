# Process the Next Issue in the Queue

## 1. Get the next ID

```bash
scripts/queue.sh wait-next
```

This blocks until the queue has an ID — if it's currently empty, it sleeps 5 seconds and checks again, forever, so a run that drains the queue keeps waiting for issues pushed onto it later (e.g. via `push-issue-to-queue`) instead of exiting.

Call this ID `<id>` for the rest of this file.

## 2. Start a clean branch from main

```bash
scripts/checkout_from_main.sh <id>
```

This fetches the latest `main`, hard-resets the local `main` to it, and (re)creates branch `issue-<id>` from it — even if `issue-<id>` already existed, it is discarded first. Every issue in the queue always starts from a clean, up-to-date `main`.

## 3. Create the issue file

Read [../../auto-new-issue/SKILL.md](../../auto-new-issue/SKILL.md) and follow all its steps for `<id>`. Its final step commits the issue file — do not commit it again here.

## 4. Create the plan

Read [../../auto-plan-issue/SKILL.md](../../auto-plan-issue/SKILL.md) and follow all its steps for `<id>`. Its final step commits the plan files — do not commit them again here.

## 5. Implement and open/mark-ready the PR

Read [../../auto-fix-issue/SKILL.md](../../auto-fix-issue/SKILL.md) and follow all its steps for `<id>`. By the end of this, the branch has been implemented, committed, pushed, and a PR exists (opened by that skill, since no PR existed yet for this fresh branch).

Record the issue's title and the PR URL/number it reports — you will need them for monitoring.

## 6. Check for pre-approval

Pre-approval is expressed in this family of skills via either of two independent sources — a `shipit` label on the GitHub issue, or a `tags:` line at the end of the local issue body containing a `:shipit:` token:

```bash
scripts/github.sh has-shipit-label <id>
```

```bash
../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```
(parse `ISSUE_FILE` from its output, resolved relative to the `auto-plan-issue` skill folder — the same pattern used by the "approved" branch of [monitor_pr.md](monitor_pr.md))

```bash
scripts/has_shipit_tag.sh <ISSUE_FILE>
```

- **Either command exits 0** — the issue is pre-approved. Skip monitoring entirely and jump directly to the **"If `approved`"** section of [monitor_pr.md](monitor_pr.md).
- **Both exit 1** — continue to Step 3 of `SKILL.md` (monitor the PR normally).
