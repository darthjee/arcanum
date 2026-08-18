# Plan: Review agent tool-permission scopes and specialist-dispatch allowlisting

Issue: [205-review-agent-tool-permission-scopes-and-specialist-dispatch-allowlisting.md](../issues/205-review-agent-tool-permission-scopes-and-specialist-dispatch-allowlisting.md)

## Overview

Audit every script a dispatched specialist agent (not architect) actually runs across the `auto-*` pipeline, classify each as safe-to-preapprove or not, ship `permission_grant.sh` migrations for the safe ones (mirroring #167/#170's `shipit` precedent), and document the resulting policy in a new `docs/agents/architecture/dispatch-permissions.md`. Architect performs the audit and writes the doc directly (`docs/agents/**` is architect's own scope); `scripter` and `skill-writer` implement the concrete grants the audit lands on.

## Context

Follow-up from #200 (architect must escalate — `OUTCOME=blocked` — rather than silently doing a blocked specialist's work itself) and its root cause, #192/#199 (the `infra` dispatch that got blocked). Precedent: #167/#170 shipped a narrowly-scoped `Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)` allowlist entry, provisioned across three config tiers (`.claude/settings.local.json`, `.claude/settings.json`, the global Claude Code `settings.json`) via `arcanum/migrations/repos/<version>/NNN.sh` scripts plus `init-claude/setup_permissions.md` for fresh onboarding — see `docs/agents/architecture/issue-tags.md`'s `shipit` paragraph.

**Corrected mental model (confirmed via Claude Code's own docs during planning):** the `Agent`/Task tool call that *launches* a subagent is not itself gated by the permission system ("Launching the subagent doesn't itself prompt for permission"). What actually gets confirmed — and, in headless/autonomous mode with no TTY, auto-denied when not pre-allowlisted — is each individual `Bash`/`Edit`/`Write` call the dispatched agent makes once it's running, exactly the same allow/deny rules used for the main session apply uniformly to every subagent. There is no `Agent(<name>)` *allow* syntax (only `deny`/`ask` exist for gating a subagent type outright). This means "blocked specialist dispatch" (#200's `OUTCOME=blocked`) is, mechanically, a blocked `Bash` call inside that specialist's run — the audit below is scoped accordingly, at the level of the actual commands specialists run, not the `Agent(...)` call itself.

**Audit finding — the dispatch surface splits cleanly in two:**

1. **Common, fixed, narrow scripts every specialist dispatch relies on**, regardless of domain (from `auto-fix-issue/steps/dispatch_agents.md`'s instruction to every dispatched specialist, and `auto-fix-all/steps/handle_comment.md`'s "Dispatching" section, which reuses the same commit call):
   - `auto-fix-issue/scripts/run_checks.sh <agent-name>` — read-only; runs `.claude/scripts/check_<agent>.sh` if the target project defines one, otherwise a no-op. Zero mutation risk.
   - `auto-fix-issue/scripts/commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model> <email> [body] [comment_url]` — commits *and pushes* (`git commit -F -` then `push_current_branch`), but only through this fixed, reviewed script — never raw `git commit`/`git push`. Every specialist's commit, on every dispatch, goes through this single call. This is the same shape of risk `wait_ci_and_merge.sh` already got an exemption for, and it is far more foundational: without it, essentially *every* autonomous specialist dispatch risks hitting a block at its own commit step, not just the `infra`/#192 CI-fix scenario.
   - The raw `git add <files>` each specialist runs immediately before calling `commit_change.sh` (per `dispatch_agents.md` step 4) — staging only, fully reversible, no network/history effect.

   None of these three are covered by any *shipped* arcanum migration today — only `wait_ci_and_merge.sh` is (confirmed via `grep` across `arcanum/migrations/repos/*/*.sh`). **Decision: ship permission-grant migrations for all three**, same three-tier pattern as #167/#170.

2. **Agent-specific, ad hoc implementation commands** (e.g. `infra` running `docker`/`make core-*` while fixing a CI issue, `node` running `yarn test`/`yarn lint`, arbitrary `git`/`gh` calls beyond staging) — these are not dispatched via any fixed instruction text; each specialist decides them itself, driven by the task at hand. This is almost certainly what actually blocked `infra` in #192/#200: an ad hoc command, not one of the three common scripts above. **Decision: do NOT preapprove these.** They are too varied to reduce to one narrowly-scoped pattern without either (a) granting something broad enough to defeat the point of narrow scoping, or (b) trying to enumerate every possible build/test command up front. Rely on #200's `OUTCOME=blocked` escalation path for these, as the issue's own Solution section already directs.

## Agents involved

- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

Three new permission patterns, decided by the audit above, to be provisioned identically to the `wait_ci_and_merge.sh` precedent:

```
Bash(auto-fix-issue/scripts/commit_change.sh *)
Bash(auto-fix-issue/scripts/run_checks.sh *)
Bash(git add *)
```

- **Migration ids**: `arcanum/migrations/repos/next/migrations.json` currently ends at id `001` (an unrelated pending entry — the `Spawned`-label sync). The new entries continue the sequence: `002` (local tier), `003` (repo tier), `004` (global tier) — scaffold each via `arcanum/migrations/generate_next.sh --type script` (run three times), then fill in.
- **Bundling**: unlike `wait_ci_and_merge.sh` (one pattern per script), bundle all three patterns above into a *single* script per tier — one `permission_grant_add` call per pattern, one shared `/dev/tty` Y/N confirmation per tier describing the bundle as one policy decision ("the common specialist-dispatch commit/check exemption package"). This keeps the migration count at 3 files instead of 9 and matches how a human would actually want to confirm this (one coherent decision, not three near-identical prompts).
- **Target files per tier** (same resolution as `0.16.0/001-003.sh`):
  - `002.sh` → `.claude/settings.local.json`, `applies_to: "local"`
  - `003.sh` → `.claude/settings.json`, `applies_to: "repo"`
  - `004.sh` → `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` (resolved the same way `0.16.0/003.sh`'s `_global_settings_file` helper does), `applies_to: "global"`
  - All three: `type: "script"`, `skippable: true` (skipping is harmless — specialists just fall back to hitting the classifier/escalation path, exactly like today).
- **`init-claude/setup_permissions.md`**: extend with a second onboarding step offering the same three-pattern bundle for freshly onboarded repos' shared `.claude/settings.json`, mirroring the existing shipit step's Y/N-ask/explain/write shape — so new repos get this without waiting for `/arcanum-migrate` to run separately.

## Architect steps (done directly, not dispatched — `docs/agents/**` is architect's own scope)

### Step 1 — Write the policy doc

Create `docs/agents/architecture/dispatch-permissions.md` documenting:
- The corrected mental model above (Agent-tool dispatch vs. inner Bash/Edit/Write gating; headless-mode auto-deny).
- The full audit table (the two categories above, with the concrete scripts/commands in each).
- The concrete decision and the resulting patterns (cross-reference to `issue-tags.md`'s `shipit` paragraph as the precedent this generalizes).
- A forward-looking policy for future specialists/dispatch paths: a new common, fixed, narrow, low-risk script used by *most or all* specialist dispatches is a candidate for a permission-grant migration (three tiers + `init-claude/setup_permissions.md`); an agent-specific, ad hoc, or broad/destructive command relies on #200's `OUTCOME=blocked` escalation instead.

### Step 2 — Cross-link

Add a one-line pointer to the new doc from `docs/agents/architecture.md` (the hub file), following its existing per-topic-file listing convention.

## Files to Change

- `docs/agents/architecture/dispatch-permissions.md` — new policy doc (architect).
- `docs/agents/architecture.md` — add the new doc to the hub listing (architect).
- `arcanum/migrations/repos/next/002.sh`, `002.md` — local-tier grant (scripter).
- `arcanum/migrations/repos/next/003.sh`, `003.md` — repo-tier grant (scripter).
- `arcanum/migrations/repos/next/004.sh`, `004.md` — global-tier grant (scripter).
- `arcanum/migrations/repos/next/migrations.json` — register the three new entries (scripter).
- `init-claude/setup_permissions.md` — extend with the second onboarding step (skill-writer).

## Notes

- Tightening `architect`'s own tool grants is explicitly out of scope for this issue (see the issue file's Solution section) — not touched by this plan.
- No `## CI Checks` section: this repo's only CI jobs (`test`/`checks` in `.circleci/config.yml`) run `core/`'s Node.js suite and are unaffected by docs/bash-migration/skill-file changes; there is no shellcheck/lint job for `arcanum/migrations/` or skill files in this repo's CI.
- The three new patterns are deliberately scoped to exactly the fixed scripts/command named above — this migration does not exempt `gh`/git write operations broadly, nor any specialist's own ad hoc implementation commands.
