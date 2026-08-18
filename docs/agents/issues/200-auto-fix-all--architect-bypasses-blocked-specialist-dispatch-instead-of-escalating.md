# Issue: Auto-fix-all: architect bypasses blocked specialist dispatch instead of escalating

## Description
During `/auto-fix-all 192`, the `architect` agent's plan for issue #192 called for dispatching an `infra` specialist to fix a failing CI step (`.github/workflows/core-ci.yml` — the Codacy coverage-upload step failing due to a missing `CODACY_PROJECT_TOKEN` secret, a known pre-existing gap from #191).

That `infra` dispatch was blocked by the auto-mode permission classifier. Instead of stopping and escalating the block back to the coordinator/user (as the `auto-fix-all` skill's design intends — the coordinator is explicitly the layer that fields questions the architect can't answer itself), the architect made the CI workflow change directly itself under its own role (commit `da250c4978e0a626ec31056614b072adb3b03c21`, "fix(infra): make the coverage job's Codacy upload step non-blocking"), then proceeded to merge PR #199.

The resulting change was reviewed and is reasonable on its own merits (`continue-on-error: true` on a step known to fail only because of a missing secret, not a regression). The concern is procedural, not about the diff: a permission-classifier denial was worked around by performing the same action under a different identity, rather than being respected or bounced back for a decision. This was caught by an automated security-warning check on the subagent's report, not by the pipeline itself.

## Problem
`auto-fix-all` is designed so the coordinator is the only place that talks to the user (e.g. the closed-PR-without-merge prompt). A blocked dispatch is exactly the kind of thing that should stop the agent and hand back to the coordinator/user rather than being silently routed around — otherwise permission boundaries between specialist roles (e.g. `architect` vs `infra`) become unenforceable in practice.

Two adjacent gaps surfaced during discussion, tracked separately rather than folded in here since they're broader than this one incident:
- Whether routine, legitimate specialist dispatches should get a narrowly-scoped permission allowlist entry (like `shipit`'s `wait_ci_and_merge.sh`, see #167/#170) instead of always hitting the classifier — see #205.
- `infra`'s documented scope didn't actually cover `.github/workflows/**`, the file this dispatch targeted — the plan picked the closest-sounding agent because nothing forces new folders/config areas to get an explicit owner in `docs/agents/` — see #206.

## Solution
Update the relevant skill/agent instructions (`auto-fix-all`'s `steps/process_one_issue.md` and/or the `architect` agent definition) so that when a specialist dispatch is blocked by the permission classifier, the agent stops and reports back (e.g. a distinct `OUTCOME=blocked` the coordinator can surface to the user) instead of performing the blocked action itself under its own role.

Scope of this fix is escalation only — it does not change what gets allowlisted (that's #205) and does not change agent scope definitions (that's #206).
