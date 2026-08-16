# Issue: shipit label should also pre-approve the final PR merge step, not just review

## Description
The `shipit` label pre-approves an issue so `auto-fix-all`'s `process_one_issue.md` skips PR review/monitoring and goes straight to waiting for CI, then merging — documented as the label's whole purpose (see `docs/agents/architecture/issue-tags.md`).

In practice, during `auto-fix-all` processing of issue #167 (`shipit`-labeled), the pipeline correctly skipped review/monitoring, but the final action — `scripts/github.sh pr-merge` (which shells out to `gh pr merge`) — was blocked by Claude Code's own auto-mode permission classifier, even though CI was green and the issue was pre-approved. The architect agent correctly refused to route around the block and instead reported back to the coordinator, which had to interrupt the pipeline and ask a human to merge PR #169 manually.

## Problem
`shipit`'s intent is to pre-approve the whole PR lifecycle for that issue — skip review *and* allow merge without further human confirmation — but today it only causes the pipeline to skip the review/monitoring step. It does nothing to get the merge action itself past Claude Code's permission classifier.

This is not just a missing allowlist entry. In `auto-fix-all/steps/process_one_issue.md`, `scripts/github.sh pr-merge` is invoked from a single shared code path — the "If approved" section — that both the `shipit` pre-approval branch *and* the normal human-review-approved branch (monitor detects an `approved` PR review) funnel into. The merge command is byte-for-byte identical regardless of which path reached it, so a plain permission-allowlist entry keyed on that command string cannot distinguish "pre-approved via `shipit`" from "a human approved this PR via review, but Claude Code should still confirm before merging it" — allowlisting `scripts/github.sh pr-merge` as-is would silently remove the confirmation step for **all** merges, not just `shipit`-preapproved ones.

## Expected Behavior
- When an issue tagged `shipit` reaches the merge step and CI has passed, the merge completes without hitting Claude Code's permission classifier, so `auto-fix-all` can go fully end-to-end unattended.
- Issues without `shipit` are completely unaffected: the normal review/monitoring path (`auto-monitor-issue-pr`) and its merge step still hit the permission classifier exactly as today, even after a human has approved the PR on GitHub — Claude Code's own confirmation is a separate, deliberate gate.

## Solution
**1. Fork the merge invocation so the two paths are never the same command.**

Introduce a new script (e.g. `auto-fix-all/scripts/wait_ci_and_merge.sh`) used *only* by the `shipit` pre-approval branch of `process_one_issue.md`: it blocks on CI the same way `wait_ci.sh` does today, and on a passing result, merges internally (calling `gh pr merge` itself) rather than reporting back to be merged via a separate Bash call. This presents Claude Code's permission layer with a single, distinctly-named Bash invocation that can be allowlisted narrowly. The normal review-approved path keeps using the existing, unmodified `wait_ci.sh` + `scripts/github.sh pr-merge` pair, untouched and still subject to manual confirmation.

**2. Provision the permission exemption via the existing arcanum migration mechanism, across all three config tiers**, mirroring the `git.email` migrations (`arcanum/migrations/repos/next/`):
- `applies_to: "local"` — writes the allowlist entry into the current clone's gitignored `.claude/settings.local.json`.
- `applies_to: "repo"` — writes it into the shared, committed `.claude/settings.json`, visible to every contributor.
- `applies_to: "global"` — writes it into Claude Code's own cross-project settings file, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` (distinct from arcanum's own `arcanum-config.json` living in the same directory — this must be Claude Code's native settings file, since that's the one its permission classifier actually reads), so every arcanum-onboarded repo on the same machine/account picks up the exemption.

None of today's existing migrations write to Claude Code's own `settings.json`/`settings.local.json` (only to arcanum's own namespaced config files via `repo_config_write`/`global_config_write`), and `.permissions.allow` is an array to append-and-dedupe into rather than a scalar key — so this needs its own small jq-based write helper rather than reusing `repo_config_write` as-is.

**3. Also seed the same allowlist entry via `init-claude`**, as a new onboarding step (none of its existing `setup_*.md` steps touch `.claude/settings.json` today), so a freshly onboarded repo gets the exemption from day one rather than waiting on the migration to run.

**4. Document the rule and its rationale** in `docs/agents/architecture/issue-tags.md`'s `shipit` section and/or wherever Claude Code permission configuration for arcanum-provisioned repos is described, including why the exemption is scoped to the dedicated shipit-only merge script rather than to `gh`/`git` write operations in general.

## Benefits
- `shipit`-tagged issues can go fully end-to-end through `auto-fix-all` unattended, actually fulfilling the label's documented pre-approval purpose instead of stalling at the last step.
- The exemption is structurally scoped to the pre-approved path — it's a different command than the one non-`shipit` merges use — rather than relying on convention or careful allowlist-pattern-writing to avoid over-broadening what gets exempted.
- Reuses and extends the existing, already-understood three-tier migration mechanism (local/repo/global) rather than inventing a new provisioning path, and keeps freshly onboarded repos in sync via `init-claude`.
