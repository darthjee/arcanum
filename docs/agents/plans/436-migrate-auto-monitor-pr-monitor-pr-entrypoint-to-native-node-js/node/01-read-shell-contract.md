# Read the shell script and pin its exact contract

Read `auto-monitor-pr/scripts/monitor_pr.sh` in full (255 lines) before writing any native code — the header comment (lines 1–55) is a useful map but is not fully trustworthy on its own (see the Notes callout in [plan.md](../plan.md) about the legacy-file-shape discrepancy at lines 27–29 vs. the actual `save_comments_state` implementation at lines 132–143).

Pin down, from the code itself, before moving to Step 02:

- The exact three-state comment lifecycle transition order: on every invocation, `processing` → `addressed` runs FIRST (lines 145–157), before any polling happens — this is not conditional on `--issue-id` and must run for both state-file shapes.
- The exact normalization shape for all three comment sources (lines 200–209): `{login, createdAt, body, id, url}`, where `id` is a GraphQL node id in every case (REST issue-comments/review-comments/reviews responses all carry a `node_id` field — this is the same node id `gh pr view --json` already returns, so no extra lookup is needed to reconcile them).
- The `:shipit:` detection is a whitespace-tolerant exact match (line 224–226: `^[[:space:]]*:shipit:[[:space:]]*$`), evaluated only against NEW comments (i.e. already filtered to `login == owner && createdAt > last_comment_time`).
- Every `gh`/`jq` failure along the way degrades to printing `pending` and exiting 0 (never a thrown/propagated error) — the only non-zero exit path is the usage-error branch at the top (lines 93–98).
- `push_current_branch` (line 159, best-effort, errors swallowed) — confirm there is genuinely no native equivalent yet (`Git.js`/`GitClient.js` currently expose no push method); if so, this is a real functional gap. Two options, pick one and record the choice in Step 04's file:
  1. Add a minimal best-effort `GitClient#pushCurrentBranch` (mirroring `arcanum/_lib/push.sh`'s tolerate-any-failure behavior) and call it.
  2. Deliberately omit it, documenting in `AutoMonitorPrMonitorPr.js`'s class doc comment why (e.g. if it's dead weight in practice — this script is invoked read-only by `ScheduleWakeup`, never right after a local commit, unlike `auto-fix-all`'s own callers of similar push helpers).
  Do not silently drop it without a recorded rationale — a parity test won't catch a missing push, since it doesn't change stdout/exit code, but it is still an intentional behavior change if dropped.
