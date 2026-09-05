# Issue: auto-fix-all / auto-monitor-pr: PR-monitor loop requires dozens of manual coordinator resumes instead of blocking

## Description

`auto-fix-all` delegates the wait for a PR's terminal state (merged/closed/approved/commented) to `auto-monitor-pr`, which spawns an `architect` subagent to run `auto-monitor-pr/scripts/monitor_pr.sh` — a script documented as blocking internally (5s-sleep poll loop) inside a single tool call for as long as it takes.

In practice this wait can span hours or days of human PR review, far beyond what a single tool call can stay open for, so the poll ends up running as a long-lived background process. Its progress notifications land on the **coordinator** (the parent session), not on the suspended `architect` subagent that is actually waiting on it — the coordinator has to `SendMessage`-resume the subagent purely to keep the wait alive, even though there is nothing new to act on.

The same code path is reached from `auto-fix-all/steps/process_one_issue.md`'s "Monitor the PR" step via `auto-monitor-issue-pr`, which resolves the PR number and then delegates straight into `auto-monitor-pr`/`monitor_pr.sh` — so this affects `auto-fix-all`'s own primary pipeline, not just the standalone `/auto-monitor-pr` skill.

Observed against `darthjee/kerghan` issue #36 / PR #43: 50+ such resume round-trips over roughly 9–10 hours, with the subagent's reported context growing on almost every round (~92k → ~117k tokens) and wall-clock duration per round growing similarly (~90 min → ~185 min). The underlying background process was also reported "killed externally" at least twice and needing a restart, with 3 duplicate instances observed alive at once on one occasion.

## Problem

- The `architect` subagent has no `ScheduleWakeup` — only the coordinator does (see `auto-fix-all/SKILL.md`'s `clear_context` step). A subagent-internal poll loop therefore cannot genuinely self-resume across a wait that outlives a single tool call; it can only survive as a background process whose completion/progress notification is delivered to the coordinator instead of to the subagent that owns the wait.
- That mismatch forces the coordinator into a manual resume loop for a wait that carries no actionable information until it resolves, growing the subagent's context and the wall-clock cost of every round for no reason.
- The long-lived background `monitor_pr.sh` process is also fragile on its own terms: it has been reported killed externally and duplicated (apparently tied to an earlier coordinator mistake of spawning and then stopping a duplicate `architect` agent), because nothing ties its lifecycle robustly to the thing that's supposed to own it.

## Repro

1. `/auto-fix-all <id>` against any repo issue whose resulting PR needs real human review (no `shipit` pre-approval label).
2. Watch the coordinator's `Agent(architect, ...)` spawn for the issue: it eventually reports back `result: "Still waiting for the background monitor to report a terminal outcome on PR #N."` and completes (status: `completed`), instead of staying blocked until the PR actually changes state.
3. The coordinator has no choice but to message the same agent again to keep the wait alive; this repeats every ~90–180 minutes for as long as the PR sits unreviewed.

## Expected Behavior

Waiting for a PR's terminal state should not require dozens of manual coordinator resumes:

- The coordinator should be re-entered only once — when the wait actually resolves to a terminal state (`merged`/`closed`/`approved`) or a new owner comment — never on an intermediate poll tick that has nothing new to report.
- No long-lived background process should need to exist (and therefore nothing to be "killed externally" or duplicated) between checks.
- Each individual check should be cheap and stateless, so the cost of a long human-review wait stays roughly constant instead of growing with every round.

## Solution

Move ownership of the PR wait from the `architect` subagent to the **coordinator**, which already has `ScheduleWakeup` and already uses it for exactly this kind of "come back later with no new context" pattern (see the `clear_context` step in `auto-fix-all/SKILL.md`). Remove the always-running background poll process entirely:

- Change `monitor_pr.sh` (or its replacement) to perform a single bounded check per invocation — one `gh pr view` + comments fetch, no internal `sleep`-loop — and report either a terminal outcome (`merged`/`closed`/`approved`/`commented`, exactly as today) or `pending`.
- On `pending`, the coordinator calls `ScheduleWakeup` to re-run that same cheap check itself after a delay, instead of delegating the poll into a subagent's single tool call and hoping it survives.
- Only once a check returns a real terminal outcome does the coordinator spawn/resume the `architect` subagent to actually act on it (merge cleanup, CI handling, comment triage, etc. — unchanged from today).

This removes the long-lived background `monitor_pr.sh` process altogether, so there is nothing left to be killed externally, duplicated, or resumed-with-growing-context — each check is a fresh, constant-cost call.

Since `auto-monitor-issue-pr` delegates straight into `auto-monitor-pr`/`monitor_pr.sh`, and `process_one_issue.md`'s "Monitor the PR" step reaches it that way, fixing the wait at this shared root covers both `auto-fix-all`'s own pipeline and the standalone `/auto-monitor-pr` skill in one change.

## Benefits

- Eliminates the dozens-of-manual-resumes pattern for a wait that carries no new information until it resolves.
- Removes the background-process lifecycle bug class entirely (killed externally, duplicated instances) since there is no persistent process left to manage.
- Keeps the cost of a long PR-review wait roughly constant instead of growing (in both tokens and wall-clock time) with every round, as seen in the ~92k→~117k token / ~90min→~185min growth observed in production.
