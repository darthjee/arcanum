# Plan: Add Agent Responsible for Ensuring Actions Are Done Through Scripts

Issue: [76-add-agent-responsible-for-ensuring-actions-are-done-through-scripts.md](../issues/76-add-agent-responsible-for-ensuring-actions-are-done-through-scripts.md)

## Overview

Create a new specialist agent `skill-reviewer` whose sole job is to read skill files (SKILL.md and step `.md` files) touched in a PR and identify violations of the "no complex inline bash" rule. It reports findings to the architect, which then decides whether to trigger `scripter` or other agents to fix them.

## Context

The architect/scripter pair enforces extraction of complex logic into scripts during skill creation, but there is no dedicated agent reviewing compliance when skills change via PRs. The `handle_comment.md` routing logic already dispatches agents by their description; adding `skill-reviewer` to `.claude/agents/` makes it a first-class specialist the architect can dispatch to.

## Implementation Steps

### Step 1 — Create the `skill-reviewer` agent definition

Create `.claude/agents/skill-reviewer.md` with:
- Frontmatter: `name: skill-reviewer`, appropriate `description` (one sentence, scoped to reviewing changed skill files), `tools: Read, Bash`.
- Body: system prompt explaining the agent's job — read each changed skill file, identify inline bash blocks with logic too complex to be inline (multi-step pipelines, loops, conditionals spanning several lines, etc.), and report violations with file path and line range. Simple, explicit one-liner commands in a code block are explicitly allowed.

### Step 2 — Register the agent in `AGENTS.md`

In the `## Agents` or equivalent section of `.claude/agents/architect.md` (the architect's own system prompt) add a row for `skill-reviewer` to the agents table so the architect knows when to delegate to it.

### Step 3 — Update `AGENTS.md` (project instructions)

Add `skill-reviewer` to the specialists table in the root `AGENTS.md`, mirroring the pattern used for `scripter`.

### Step 4 — Update architecture documentation

In `docs/agents/architecture.md`, add a brief description of `skill-reviewer` under an appropriate section (e.g. extend the "Architect Delegation" section or add an "Agent Roster" subsection) so future contributors understand when and why to trigger it.

## Files to Change

- `.claude/agents/skill-reviewer.md` — new file: agent definition
- `.claude/agents/architect.md` — add `skill-reviewer` row to the agents table
- `AGENTS.md` — add `skill-reviewer` to the specialist agents table
- `docs/agents/architecture.md` — document the new agent's role

## Notes

- The `skill-reviewer` agent does **not** fix violations — it only reports them. The architect decides what to do with the report (typically dispatch `scripter`).
- Tools needed: `Read` (to open changed files) and `Bash` (to run simple `gh pr diff --name-only` style commands for discovering changed files). No dedicated script is needed; the commands are simple one-liners and any filtering logic belongs to AI judgment, not a bash script.
- The integration into `auto-fix-all`/`auto-monitor-issue-pr` flow (actually triggering `skill-reviewer` during PR review) is intentionally left for a follow-up issue — this plan only creates the agent definition and wires up the documentation so the architect can already dispatch it via `handle_comment.md`'s routing logic.
