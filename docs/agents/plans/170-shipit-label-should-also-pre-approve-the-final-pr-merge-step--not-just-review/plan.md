# Plan: shipit label should also pre-approve the final PR merge step, not just review

Issue: [170-shipit-label-should-also-pre-approve-the-final-pr-merge-step--not-just-review.md](../issues/170-shipit-label-should-also-pre-approve-the-final-pr-merge-step--not-just-review.md)

## Overview

Fork the `shipit`-preapproved merge path into its own dedicated script so it presents Claude Code's permission classifier with a single, distinctly-named Bash invocation that can be allowlisted narrowly — without touching the normal, human-review-approved merge path, which shares the exact same `scripts/github.sh pr-merge` call today and must stay classifier-confirmed. Provision the allowlist entry for that new script via three new arcanum migrations (local/repo/global tiers) plus a new `init-claude` onboarding step, and document the exemption's scope and rationale.

## Context

`shipit` pre-approves an issue so `auto-fix-all` skips PR review/monitoring, but the final `scripts/github.sh pr-merge` call still gets blocked by Claude Code's permission classifier, defeating the label's purpose (see issue #170, and the #167 incident it references).

The key constraint driving this plan: in `auto-fix-all/steps/process_one_issue.md`, `scripts/github.sh pr-merge` is invoked from a single shared "If approved" section reached both by the `shipit` pre-approval branch and by the normal path (monitor detects a human `approved` review). The merge command is identical either way, so a plain allowlist entry on that command string would silently remove confirmation for **all** merges — violating the issue's "non-`shipit` issues unaffected" acceptance criterion. The fix therefore has to fork the *invocation*, not just add a permission rule.

## Implementation Steps

### Step 1 — Shared permission-grant helper

Create `arcanum/_lib/permission_grant.sh`, following the existing `_lib` convention (see `global_config.sh`/`repo_config.sh`): sourced, lock-protected (reuse `lock.sh`), atomic write via `.tmp` + `mv`.

Expose `permission_grant_add <file> <pattern>`:
- Ensures `<file>`'s parent directory exists.
- `jq '.permissions.allow = ((.permissions.allow // []) + [$pattern] | unique)'` — appends and dedupes, never overwrites unrelated content already in the file (e.g. an existing `permissions.deny`, or other top-level keys).
- Degrades silently (stderr warning, no-op, still exits 0) if the parent directory can't be created — same failure posture as `global_config_write`.

This is deliberately **not** built on `repo_config_write`/`global_config_write`: those assume arcanum's own `.<namespace>.<key> = <scalar>` shape, whereas `permissions.allow` is a top-level Claude Code key (no arcanum namespace) holding an array to append into, not a scalar to overwrite.

Also give the file a small direct-invocation CLI dispatcher (`if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then case "${1:-}" in add) shift; permission_grant_add "$@" ;; esac; fi`), so `init-claude`'s step (Step 5 below) — which runs as an agent issuing Bash-tool commands, not a script that can `source` a lib — can call it as `arcanum/_lib/permission_grant.sh add <file> <pattern>` without needing a separate wrapper script.

### Step 2 — Fork the shipit merge path: `wait_ci_and_merge.sh`

Create `auto-fix-all/scripts/wait_ci_and_merge.sh`. Keep it a thin orchestrator over the two *existing*, unmodified scripts — no duplicated CI-polling or merge logic:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:?Usage: $0 <repo_path>}"

output="$("${SCRIPT_DIR}/wait_ci.sh" "$REPO_PATH")"
status="$(head -1 <<<"$output")"

if [[ "$status" != "passed" ]]; then
  echo "$output"   # "failed" + check-run names, same contract as wait_ci.sh
  exit 0
fi

"${SCRIPT_DIR}/github.sh" pr-merge "$REPO_PATH"
```

The internal calls to `wait_ci.sh` and `github.sh pr-merge` are ordinary subprocess invocations *within this one script's process* — Claude Code's permission classifier only ever sees the single top-level Bash-tool command (`wait_ci_and_merge.sh <repo_path>`), not what it execs internally. This is the mechanism that lets one narrowly-scoped allowlist entry cover the whole pre-approved wait-then-merge sequence.

Output contract for callers: first line `"passed"` means the merge already happened internally (nothing left to call); first line `"failed"` means CI failed and the merge was never attempted — identical shape to `wait_ci.sh` today, so `process_one_issue.md`'s existing failure-handling text mostly carries over unchanged (see Step 3).

### Step 3 — Rewire `process_one_issue.md`'s shipit branch only

In `auto-fix-all/steps/process_one_issue.md`:

- Split the current "If approved" section (`process_one_issue.md:106-141`) into two, since it's reached from two different callers today:
  - **"If approved via review"** — unchanged content, still `wait_ci.sh` then separately `scripts/github.sh pr-merge`, still classifier-confirmed. Reached only from "Monitor the PR" → `approved`.
  - **"If pre-approved via shipit"** — new section, reached only from "Check for pre-approval" → exits 0. Calls `scripts/wait_ci_and_merge.sh "$REPO_PATH"` once. On first line `"passed"`: merge is already done, go straight to `cleanup-branch` + `OUTCOME=merged`. On first line `"failed"`: same fix-and-retry loop as today, but retry by calling `wait_ci_and_merge.sh` again (not `wait_ci.sh`).
- Update the "Check for pre-approval" step's "Exits 0" bullet (`process_one_issue.md:73`) to point at the new "If pre-approved via shipit" section instead of "If approved".
- Leave Step 4 ("Implement and open/mark-ready the PR") and everything else untouched.

### Step 4 — Provision the allowlist via three new migrations

Use `arcanum/migrations/generate_next.sh --type script` three times to scaffold sequential entries in `arcanum/migrations/repos/next/` (each defaults `applies_to: "local"` per the scaffolding note — hand-edit two of the three afterward in `migrations.json`):

- **local** → writes to `.claude/settings.local.json`.
- **repo** → writes to `.claude/settings.json`.
- **global** → writes to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` (Claude Code's own native global settings file — **not** arcanum's `arcanum-config.json` living in the same directory).

Each script's `run` calls `permission_grant_add <target_file> "Bash(auto-fix-all/scripts/wait_ci_and_merge.sh:*)"` (confirm the exact glob syntax Claude Code's permission matcher expects against this repo's existing `.claude/settings.local.json` entries, e.g. `Bash(scripts/queue.sh save *)`).

Unlike the `git.email` migrations (002/003/001-next), this is a **security-relevant permission grant, not a personal value** — no need to check the other tiers first (redundancy across tiers is harmless; Claude Code merges allow-lists across all of them), but each script should explain what it's granting and why before writing, prompting `[Y]es/[S]kip` via `/dev/tty` (same pattern as migration `003.sh`'s warning-then-confirm flow). **When no interactive terminal is available, skip silently rather than writing** — the opposite default from the git-email migrations' "guess and write silently", since this loosens a security gate and shouldn't happen without an explicit yes from whoever is present. All three are `skippable: true`.

Each migration's paired `NNN.md` explains, in the same style as `001.md`/`003.md`, what it grants, why, and that it's scoped to this one script rather than to `gh`/git write operations broadly.

### Step 5 — `init-claude` onboarding step

Create `init-claude/setup_permissions.md`, modeled on `setup_auto_fix_all_config.md`'s shape (ask, explain, write): ask whether to seed the same `shipit`-merge exemption into `.claude/settings.json` for this freshly onboarded repo, explain what it does and that it's committed/visible to all contributors, and on yes call `arcanum/_lib/permission_grant.sh add .claude/settings.json "Bash(auto-fix-all/scripts/wait_ci_and_merge.sh:*)"` (resolved relative to the `init-claude` skill folder). Skip silently on no.

Wire it into `init-claude/SKILL.md` as a new step (e.g. after Step 11, "Setup `auto-fix-all` personal run behavior" — same neighborhood as the other `auto-fix-all`-adjacent onboarding concerns), renumbering subsequent steps.

### Step 6 — Documentation

Update `docs/agents/architecture/issue-tags.md`'s `shipit` paragraph to describe the merge-time exemption (currently it only mentions review/monitoring being skipped): note the dedicated `wait_ci_and_merge.sh` script, that the permission allowlist is scoped to that script specifically (not `gh`/git writes in general), and that it's provisioned via the local/repo/global migrations plus `init-claude`. Cross-reference `wait_ci_and_merge.sh` and the three migration files.

## Files to Change

- `arcanum/_lib/permission_grant.sh` — new, shared array-append helper + CLI dispatcher.
- `auto-fix-all/scripts/wait_ci_and_merge.sh` — new, shipit-only combined wait+merge orchestrator.
- `auto-fix-all/steps/process_one_issue.md` — fork "If approved" into review-approved (unchanged) vs. shipit-preapproved (new, uses `wait_ci_and_merge.sh`) branches.
- `arcanum/migrations/repos/next/migrations.json` + 3 new `NNN.sh`/`NNN.md` pairs — local/repo/global allowlist-provisioning migrations.
- `init-claude/setup_permissions.md` — new onboarding step.
- `init-claude/SKILL.md` — add the new step to the numbered list.
- `docs/agents/architecture/issue-tags.md` — document the exemption under `shipit`.

## Notes

- Deliberately did not touch `auto-fix-all/scripts/wait_ci.sh` or `scripts/github.sh pr-merge` themselves — both stay exactly as they are today, still used unmodified by the non-`shipit` path, which is what keeps that path's confirmation behavior untouched (acceptance criterion 4).
- The exact Bash permission-pattern syntax (`Bash(auto-fix-all/scripts/wait_ci_and_merge.sh:*)` vs. some other glob form) should be verified against how this repo's own `.claude/settings.local.json` entries are actually matched before being baked into the three migration scripts — copy the working form from an existing entry rather than guessing.
- Confirm during implementation whether Claude Code's permission-matching is a literal command-prefix/glob match (the assumption this whole plan relies on) or something more semantic that could still flag the inner `gh pr merge` call even when it's not a separate Bash-tool invocation — if it turns out to be semantic, the "fork the invocation" approach in Step 2/3 may need revisiting.
