# Issue: Add escape hatches to AGENTS.md's two absolute path rules (Agentlinter clarity_escape-hatch-missing)

## Description
Codacy's Agentlinter tool flags two absolute rules in `AGENTS.md` for having no escape hatch — i.e. they tell an agent what it *must* do with no stated exception, which tends to produce brittle or over-literal compliance when a genuine edge case shows up:

- `AGENTS.md:13` — "Paths referenced in instructions (e.g. \"look for file X\") must be relative, never absolute."
- `AGENTS.md:14` — "When an absolute path is required (e.g. inside a script), it must be extracted into a variable instead of repeated inline."

## Problem
`AGENTS.md` is the project-instructions document every specialist agent (and Claude Code session) loads before acting in this repo — see `CLAUDE.md`'s pointer to it. An absolute rule with no named exception either (a) is actually exception-free, in which case it costs nothing to say so explicitly, or (b) has a real exception nobody has written down, in which case an agent following it literally may take the wrong action (or waste effort working around the rule) the first time it hits that case, instead of taking the documented escape hatch.

Investigation into the current codebase (see Solution below) found a real, already-practiced exception to line 13 that is not currently documented in `AGENTS.md` itself: `docs/agents/architecture/repo-path-threading.md` and `auto-fix-issue/steps/dispatch_agents.md` both establish that `REPO_PATH`, once resolved, is substituted as a literal absolute path directly into the prose instructions of a spawned `Agent(...)` call, because a freshly spawned subagent has no `$REPO_PATH` shell variable to resolve. Line 14, by contrast, has no concrete counter-example anywhere in the tracked repo today.

## Expected Behavior
- Both rules at `AGENTS.md:13` and `AGENTS.md:14` either state they have no exceptions, or name their actual exception(s).
- Re-running Agentlinter/Codacy on `AGENTS.md` shows zero `clarity_escape-hatch-missing` findings for these two lines.

## Solution
For each of the two rules, document the real answer found by investigation:

- **Line 13** ("paths must be relative, never absolute"): name the real, already-practiced exception — a spawned `Agent(...)` call has no shell variable of its own, so `REPO_PATH`/other resolved absolute paths must be substituted as literal absolute text directly into that agent's prose instructions (see `docs/agents/architecture/repo-path-threading.md` and `auto-fix-issue/steps/dispatch_agents.md`'s literal-`<repo_path>`-substitution convention). Proposed wording: "...must be relative, never absolute — except when substituting a resolved value like `REPO_PATH` as literal text into a spawned agent's prose instructions, since that agent has no shell variable of its own to resolve it."
- **Line 14** ("absolute paths required inside scripts must be extracted into a variable"): no concrete counter-example exists anywhere in the tracked repo today (no `.mcp.json`, no `.claude/settings*.json`, no tracked symlinks, no third-party config file repeating an inline absolute path). State this rule as exception-free: "...must be extracted into a variable instead of repeated inline, with no exceptions." If a genuine case later requires it, that will be the point to add a real exception rather than one written speculatively now.

This is a documentation-only change to `AGENTS.md`; delegate to the `architect` agent per the agents table in `AGENTS.md` itself (root-level project documentation).

## Benefits
- Removes ambiguity from two of the project's core behavioral rules, reducing the chance a future agent session either over-applies the rule where an exception was intended, or silently violates it when no exception actually exists.
- Documents the `REPO_PATH`-into-agent-prompt exception that today lives only implicitly across `repo-path-threading.md` and `dispatch_agents.md`, making it discoverable from `AGENTS.md` itself.
- Clears both `clarity_escape-hatch-missing` Codacy findings in `AGENTS.md`.
