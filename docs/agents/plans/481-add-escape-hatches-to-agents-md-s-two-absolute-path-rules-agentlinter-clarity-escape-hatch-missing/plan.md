# Plan: Add escape hatches to AGENTS.md's two absolute path rules (Agentlinter clarity_escape-hatch-missing)

Issue: [481-add-escape-hatches-to-agents-md-s-two-absolute-path-rules-agentlinter-clarity-escape-hatch-missing.md](../issues/481-add-escape-hatches-to-agents-md-s-two-absolute-path-rules-agentlinter-clarity-escape-hatch-missing.md)

## Overview
`AGENTS.md:13` and `AGENTS.md:14` are absolute rules about path usage with no stated exception, which Codacy's Agentlinter flags (`clarity_escape-hatch-missing`). Investigation during discussion of this issue found a real, already-practiced exception to line 13 (documented elsewhere in the repo but not surfaced in `AGENTS.md` itself) and no real exception to line 14. This plan documents both findings directly in the two rules.

## Context
- `docs/agents/architecture/repo-path-threading.md` and `auto-fix-issue/steps/dispatch_agents.md` establish that `REPO_PATH`, once resolved, is substituted as literal absolute text into a spawned `Agent(...)` call's prose instructions, because a freshly spawned subagent has no `$REPO_PATH` shell variable to resolve. This is a real, required exception to line 13's "must be relative, never absolute" rule.
- No tracked file in the repo (no `.mcp.json`, no `.claude/settings*.json`, no symlinks, no other third-party config) currently repeats an absolute path inline instead of extracting it into a variable. Line 14 has no real exception today.
- This is a documentation-only change scoped entirely to `AGENTS.md`, a root-level file — no specialist agent's scope covers it, so it stays with `architect` (no agent split).

## Implementation Steps

### Step 1 — Add the exception to line 13
Edit `AGENTS.md:13` to name the real exception: substituting a resolved absolute value (e.g. `REPO_PATH`) as literal text into a spawned agent's prose instructions, since that agent has no shell variable of its own to resolve it. Suggested wording: "Paths referenced in instructions (e.g. \"look for file X\") must be relative, never absolute — except when substituting a resolved value like `REPO_PATH` as literal text into a spawned agent's prose instructions, since that agent has no shell variable of its own to resolve it." Optionally cross-reference `docs/agents/architecture/repo-path-threading.md` for the full convention.

### Step 2 — State line 14 as exception-free
Edit `AGENTS.md:14` to explicitly state it has no exceptions, e.g. append ", with no exceptions" (or equivalent phrasing consistent with the rest of the document's tone).

## Files to Change
- `AGENTS.md` — add the escape hatch to line 13 and the "no exceptions" statement to line 14.

## Notes
- Re-run Agentlinter/Codacy on `AGENTS.md` after the edit to confirm both `clarity_escape-hatch-missing` findings for these lines are cleared.
- If a future change introduces a real exception to line 14 (e.g. a third-party config format that can't reference a variable), update the "no exceptions" wording then rather than speculating now.
