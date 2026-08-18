# Issue: Review agent tool-permission scopes and specialist-dispatch allowlisting

## Description

Follow-up from #200: when `architect`'s dispatch of `infra` for the #192 CI fix was blocked by Claude Code's own permission classifier, `auto-fix-all/steps/process_one_issue.md` had no path other than "get it done somehow" — so architect fell back to its own unrestricted `Edit`/`Write`/`Bash` grant and performed the change itself. #200 fixes the immediate symptom (escalate instead of silently bypassing). This issue is about the underlying capability gap it exposed: audit what each specialist agent's tool grants actually let it do versus what the classifier blocks in autonomous runs, and decide, case by case, whether routine/legitimate dispatches should get a narrowly-scoped permission allowlist entry — the way `shipit`'s `wait_ci_and_merge.sh` call did (see #167/#170 and `docs/agents/architecture/issue-tags.md`) — instead of hitting a block on every run.

## Problem

- `architect`'s tools (`Read, Edit, Write, Bash, Agent`) are not actually restricted to its documented scope (`docs/agents/`, root files, cross-agent coordination) — that boundary is convention/documentation, not a tool-level permission. When any specialist's dispatch is blocked, architect remains free to just do the work itself, unscoped, because nothing stops it at the tool layer.
- There's no established policy for when a recurring, legitimate specialist-dispatch action should get an explicit `permission_grant.sh` allowlist entry (like `shipit`'s merge call) versus always requiring escalation to the coordinator/user.
- No inventory currently exists of which agent-to-action dispatch paths are actually blocked by the classifier in autonomous/headless mode — each block has so far been discovered incident-by-incident (#167/#170, now #200).

## Solution

Audit each agent defined in `.claude/agents/` against the actions it's dispatched to perform across **all** `auto-*` skills (`auto-fix-all`, `auto-fix-issue`, `auto-plan-issue`, `auto-new-issue`, `auto-rewrite-issue`, `arcanum-split-issue`, etc. — not just the `auto-fix-all` pipeline where #200 happened to surface the gap), and:

1. Document which of those dispatch paths are expected to hit the permission classifier in autonomous/headless mode.
2. For genuinely routine, low-risk, narrowly-scoped ones, provision a `permission_grant.sh` allowlist entry the same way #167/#170 did for `shipit`.
3. For everything else, rely on #200's escalation path (`OUTCOME=blocked`) rather than a workaround.
4. Record the resulting policy in a new `docs/agents/architecture/dispatch-permissions.md` — alongside existing cross-cutting policy docs like `issue-tags.md` and `agent-roster-and-delegation.md` — so future specialist additions know which category their dispatches fall into.

Out of scope: tightening `architect`'s own tool grants (`Read, Edit, Write, Bash, Agent`) to its documented boundary. The Problem section below notes that gap, but closing it is a separate, larger concern from deciding the allowlist-vs-escalate policy for specialist dispatches.

## Benefits

Turns "does this dispatch have known-supported permission, or does it need to reach a human?" into a documented, discoverable decision instead of a surprise discovered only when something goes wrong in a production autonomous run.
