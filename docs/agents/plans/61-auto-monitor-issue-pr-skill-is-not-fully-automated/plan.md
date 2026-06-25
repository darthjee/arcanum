# Plan: auto-monitor-issue-pr skill is not fully automated

Issue: [61-auto-monitor-issue-pr-skill-is-not-fully-automated.md](../../issues/61-auto-monitor-issue-pr-skill-is-not-fully-automated.md)

## Overview

`.claude/settings.local.json` is a local (gitignored) Claude Code permission file that accumulates one narrow `allow` rule per PR number for `auto-monitor-pr/scripts/monitor_pr.sh` and `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`. Since each issue gets a new PR number, the narrow rules never match a future PR, so Claude Code stops to ask for permission again — even though neither skill's `run.md` ever asks the user anything. The fix is to widen those specific rules to match any PR number, remove the now-redundant narrow entries, and add a short warning note so the rules don't get re-narrowed in the future.

## Context

Both `auto-monitor-pr/SKILL.md` and `auto-monitor-issue-pr/SKILL.md` document a no-confirmation, no-reaction-loop contract. The actual blocker is operational/config, not a logic bug: the permission system in `.claude/settings.local.json` keeps adding rules of the exact form

```
Bash(auto-monitor-pr/scripts/monitor_pr.sh <pr_number> *)
Bash(auto-monitor-issue-pr/scripts/resolve_pr_number.sh <pr_number> *)
```

(and their absolute-path equivalents under both `/Users/darthjee/projetos/mine/arcanum/...` and the skills' own installed-skill paths, e.g. `/Users/darthjee/.claude-favini/skills/...`), instead of a single wildcard rule that covers any PR number.

## Implementation Steps

### Step 1 — Audit existing narrow rules

In `.claude/settings.local.json`, find every `allow` entry matching:
- `Bash(auto-monitor-pr/scripts/monitor_pr.sh <number> *)`
- `Bash(auto-monitor-issue-pr/scripts/resolve_pr_number.sh <number> *)`
- Any absolute-path variants of the same two scripts (under any installed-skill path seen in the file, e.g. `/Users/darthjee/.claude-favini/skills/...` or `/Users/darthjee/projetos/mine/arcanum/...`).

### Step 2 — Add wildcard rules

Add one wildcard rule per distinct script path form found in Step 1, replacing the fixed PR number with `*`:
- `Bash(auto-monitor-pr/scripts/monitor_pr.sh *)`
- `Bash(auto-monitor-issue-pr/scripts/resolve_pr_number.sh *)`
- plus the absolute-path equivalents actually present in the file.

### Step 3 — Remove redundant narrow entries

Delete every narrow per-PR-number entry now covered by the wildcard rules added in Step 2, to keep the file from growing unbounded again.

### Step 4 — Document the gotcha

Add a short note warning future contributors not to let the permission system re-narrow these two scripts' rules back to a fixed PR number. Place it in `auto-monitor-issue-pr/SKILL.md` (or a short auxiliary note referenced from it) since that's the skill whose contract ("no confirmation loop") this directly protects; cross-reference from `auto-monitor-pr/SKILL.md` if useful.

## Files to Change

- `.claude/settings.local.json` — replace narrow per-PR-number `allow` entries for `monitor_pr.sh` and `resolve_pr_number.sh` (all path forms present) with wildcard equivalents; this file is local/gitignored, so this step is a one-time manual cleanup performed on this machine, not something shipped in the PR.
- `auto-monitor-issue-pr/SKILL.md` — add a short note about keeping the permission rule wildcarded on PR number for `resolve_pr_number.sh` (and, by extension, `monitor_pr.sh`).

## Notes

- `.claude/settings.local.json` is excluded from git entirely (matched by a global gitignore rule, confirmed via `git check-ignore -v .claude/settings.local.json`), so the actual permission-file edit cannot be committed or reviewed in the PR — only the documentation note (Step 4) is a real repo change. The PR for this issue is therefore a docs-only change; the settings-file cleanup is applied locally as a side effect of doing this work but has no diff to show.
- No script changes are needed — `monitor_pr.sh` and `resolve_pr_number.sh` already accept any PR number as an argument; the issue is purely about the permission rule shape, not the scripts' behavior.
