# Dispatch Permissions

Audit and policy for when a specialist agent's dispatched work should get an explicit
`permission_grant.sh` allowlist entry (so Claude Code's own permission classifier never
blocks it in autonomous/headless runs) versus when it should rely on the escalation path
instead. Follow-up from #200 (architect must escalate — `OUTCOME=blocked` — rather than
silently doing a blocked specialist's work itself) and its root cause, #192/#199 (the
`infra` dispatch that got blocked while fixing a CI failure).

## Corrected mental model

The `Agent`/Task tool call that *launches* a subagent is not itself gated by the
permission system — launching the subagent doesn't itself prompt for permission. What
actually gets confirmed — and, in headless/autonomous mode with no TTY, auto-denied when
not pre-allowlisted — is each individual `Bash`/`Edit`/`Write` call the dispatched agent
makes once it's running, exactly the same allow/deny rules used for the main session
apply uniformly to every subagent. There is no `Agent(<name>)` *allow* syntax — only
`deny`/`ask` exist for gating a subagent type outright.

This means a "blocked specialist dispatch" (#200's `OUTCOME=blocked`) is, mechanically, a
blocked `Bash` (or `Edit`/`Write`) call *inside* that specialist's run, not a block on the
`Agent(...)` call that launched it. The audit below is scoped accordingly, at the level of
the actual commands specialists run.

## Audit

The dispatch surface splits cleanly into two categories.

### 1. Common, fixed, narrow scripts every specialist dispatch relies on

Regardless of domain — from `auto-fix-issue/steps/dispatch_agents.md`'s instruction to
every dispatched specialist, and `auto-fix-all/steps/handle_comment.md`'s "Dispatching"
section, which reuses the same commit call:

| Script | Risk |
|--------|------|
| `auto-fix-issue/scripts/run_checks.sh <agent-name>` | Read-only; runs `.claude/scripts/check_<agent>.sh` if the target project defines one, otherwise a no-op. Zero mutation risk. |
| `auto-fix-issue/scripts/commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model> <email> [body] [comment_url]` | Commits *and pushes* (`git commit -F -` then `push_current_branch`), but only through this fixed, reviewed script — never raw `git commit`/`git push`. Every specialist's commit, on every dispatch, goes through this single call. |
| `git add <files>` (raw, run immediately before `commit_change.sh`, per `dispatch_agents.md` step 4) | Staging only, fully reversible, no network/history effect. |

None of these three were covered by any shipped arcanum migration before this issue —
only `wait_ci_and_merge.sh` (the `shipit` precedent, see the "Precedent" section below)
was. **Decision: preapprove all three**, via a `permission_grant.sh` allowlist entry
provisioned the same way `shipit`'s was.

### 2. Agent-specific, ad hoc implementation commands

E.g. `infra` running `docker`/`make core-*` while fixing a CI issue, `node` running
`yarn test`/`yarn lint`, arbitrary `git`/`gh` calls beyond staging. These are not
dispatched via any fixed instruction text; each specialist decides them itself, driven by
the task at hand. This is almost certainly what actually blocked `infra` in #192/#200: an
ad hoc command, not one of the three common scripts above.

**Decision: do NOT preapprove these.** They are too varied to reduce to one
narrowly-scoped pattern without either (a) granting something broad enough to defeat the
point of narrow scoping, or (b) trying to enumerate every possible build/test command up
front. Rely on #200's `OUTCOME=blocked` escalation path for these, as its own Solution
section already directs.

## Decision and resulting patterns

Three new permission patterns, provisioned identically to the `wait_ci_and_merge.sh`
precedent (see [Issue Tags](issue-tags.md)'s `shipit` paragraph):

```
Bash(auto-fix-issue/scripts/commit_change.sh *)
Bash(auto-fix-issue/scripts/run_checks.sh *)
Bash(git add *)
```

Provisioned across all three config tiers by `arcanum/migrations/repos/next/002.sh`
(local, `.claude/settings.local.json`), `003.sh` (repo, shared/committed
`.claude/settings.json`), and `004.sh` (global, Claude Code's own cross-project
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`), plus a second onboarding step in
`init-claude/setup_permissions.md` for freshly onboarded repos — the same three-tier +
onboarding shape `shipit`'s `wait_ci_and_merge.sh` exemption used (issues #167/#170).

## Policy for future specialists/dispatch paths

When a new specialist or dispatch path is added:

- If it introduces a **new common, fixed, narrow, low-risk script used by most or all
  specialist dispatches** (the same shape as `run_checks.sh`/`commit_change.sh`/`git add`
  above), it's a candidate for its own `permission_grant.sh` allowlist entry: three
  tier-scoped migration scripts (local/repo/global) plus an `init-claude/setup_permissions.md`
  onboarding step, mirroring this issue and the `shipit` precedent it generalizes.
- If it's an **agent-specific, ad hoc, or broad/destructive command** (build/test
  tooling, arbitrary `git`/`gh` writes, anything a specialist decides for itself rather
  than being handed a fixed instruction), do not preapprove it. Rely on #200's
  `OUTCOME=blocked` escalation path instead.

Out of scope for this policy: tightening `architect`'s own tool grants
(`Read, Edit, Write, Bash, Agent`) to its documented boundary — that gap is noted in #205
but is a separate, larger concern from this allowlist-vs-escalate decision for specialist
dispatches.
