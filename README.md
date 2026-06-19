# Arcanum

A collection of Claude Code skills — reusable slash commands that extend Claude Code with project workflows.

**Current Version:** [0.0.1](https://github.com/darthjee/arcanum/releases/tag/0.0.1)

**Next Release:** [0.0.2](https://github.com/darthjee/arcanum/compare/0.0.1...main)

## What are skills?

Skills are prompt files that Claude Code loads as slash commands. Each skill lives in its own folder under the repository root and is activated by typing `/skill-name` in Claude Code.

## Available skills

| Skill | Description |
|-------|-------------|
| [`/init-claude`](init-claude/) | Initializes a project's AI configuration: creates or consolidates `CLAUDE.md`, `.github/copilot-instructions.md`, and `AGENTS.md`, then scaffolds `docs/agents/` with architecture, folder structure, and contributing guides. |
| [`/new-issue`](new-issue/) | Creates a new issue file in the project's `docs/agents/issues/` folder. |
| [`/auto-new-issue`](auto-new-issue/) | Autonomously creates a new issue file with no user interaction, then commits it and syncs it to GitHub. |
| [`/plan-issue`](plan-issue/) | Reads an issue file, analyzes the codebase, and writes a structured implementation plan in `docs/agents/plans/`. |
| [`/auto-plan-issue`](auto-plan-issue/) | Autonomously writes an implementation plan with no user interaction, splitting it across the target project's specialist agents when any are configured, then commits it. |
| [`/check-plan`](check-plan/) | Validates an existing implementation plan, identifies problems and open questions, and optionally invokes `/fix-issue`. |
| [`/new-plan`](new-plan/) | Creates a new issue and immediately writes its implementation plan, in one uninterrupted flow. |
| [`/fix-issue`](fix-issue/) | Reads an issue and its plan, then opens a pull request to fix it. |
| [`/auto-fix-issue`](auto-fix-issue/) | Autonomously implements a planned issue with no user interaction, dispatching the plan's specialist agents in parallel, reviewing and re-dispatching until correct, then opening or marking ready a pull request. |
| [`/auto-fix-all`](auto-fix-all/) | Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, reacting to PR comments, approvals, CI failures, and closes until every issue is merged or skipped. |

## Installation

Clone this repository into your Claude Code skills directory:

```bash
git clone git@github.com:darthjee/arcanum.git ~/.claude/skills
```

Claude Code automatically discovers skills from that directory.

## Skill structure

Each skill is a folder containing a `SKILL.md` entry point and optional auxiliary markdown files:

```
skill-name/
├── SKILL.md          ← entry point, loaded when /skill-name is invoked
├── step-one.md       ← auxiliary instructions, referenced from SKILL.md
└── step-two.md
```

The `SKILL.md` file requires a frontmatter header:

```markdown
---
name: skill-name
description: Short description shown in the skill list.
---

Instructions for Claude...
```
