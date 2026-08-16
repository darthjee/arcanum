# shipit label should also pre-approve the final PR merge step, not just review

## Context

The `shipit` label pre-approves an issue so `auto-fix-all`'s `process_one_issue.md` skips PR review/monitoring and goes straight to waiting for CI, then merging — this is documented as the label's whole purpose (see `docs/agents/architecture/issue-tags.md`).

In practice, during `auto-fix-all` processing of issue #167, the target issue carried `shipit`, and the pipeline correctly skipped the review/monitoring step. However, the final action — `scripts/github.sh pr-merge` (which shells out to `gh pr merge` to squash-merge the PR) — was blocked by Claude Code's own auto-mode permission classifier, even though CI was green and the issue was pre-approved. The architect agent correctly refused to route around the block (e.g. by invoking `gh pr merge` directly under a different guise) and instead reported back to the coordinator, which had to interrupt the pipeline and ask a human to merge PR #169 manually.

The root problem: `shipit`'s intent is to pre-approve the whole PR lifecycle for that issue — skip review *and* allow merge without further human confirmation — but today it only causes the pipeline to skip the review/monitoring step. It does nothing to get the merge action itself past Claude Code's permission classifier, so `shipit`-tagged issues still stall at the merge step and require manual intervention, defeating the purpose of the pre-approval tag.

## What needs to be done

Make it possible for the merge step reached via the `shipit` pre-approval path in `auto-fix-all/steps/process_one_issue.md` (the `scripts/github.sh pr-merge` call under "If CI passed") to run to completion without hitting a Claude Code permission classifier block requiring manual approval.

This likely means introducing/documenting a Claude Code permission rule (e.g. an allowlist entry in a `.claude/settings.json` `permissions.allow` list, or equivalent mechanism) scoped specifically to `scripts/github.sh pr-merge` (or however it's invoked under the hood), rather than broadly permissioning all `gh`/git write operations. Consider:

- Where such a rule should live and how it gets provisioned into a project — e.g. whether `init-claude` should set it up as part of onboarding a repo onto arcanum, alongside its existing `.claude/` setup steps, or whether it belongs elsewhere.
- Scoping the exemption narrowly enough that it only covers the pre-approved merge path, not merges in general — a non-`shipit` issue must still go through the normal review/monitoring flow untouched.
- Documenting the rule and its rationale (e.g. in `docs/agents/architecture/issue-tags.md`'s `shipit` section, and/or wherever Claude Code permission configuration for this repo/arcanum-provisioned repos is described) so it's clear why the merge command is exempted from manual confirmation and under what conditions.

## Acceptance criteria

- [ ] When an issue tagged `shipit` reaches the merge step in `auto-fix-all`'s `process_one_issue.md` and CI has passed, `scripts/github.sh pr-merge` completes without being blocked by Claude Code's permission classifier, so the pipeline can go fully end-to-end unattended.
- [ ] The permission rule/allowlist entry that enables this is documented, including why it's scoped the way it is.
- [ ] The exemption is scoped narrowly to the pre-approved merge action, not to `gh`/git write operations in general.
- [ ] Issues without the `shipit` label are unaffected — the existing PR review/monitoring path (`auto-monitor-issue-pr`) and its own merge step are unchanged.
