# Arcanum

A collection of Claude Code skills — reusable slash commands that extend Claude Code with project workflows.

## What are skills?

Skills are prompt files that Claude Code loads as slash commands. Each skill lives in its own folder under the repository root and is activated by typing `/skill-name` in Claude Code.

## Available skills

| Skill | Description |
|-------|-------------|
| [`/init-claude`](init-claude/) | Initializes a project's AI configuration: creates or consolidates `CLAUDE.md`, `.github/copilot-instructions.md`, and `AGENTS.md`, then scaffolds `docs/agents/` with architecture, folder structure, and contributing guides. |
| [`/new-issue`](new-issue/) | Creates a new issue file in the project's `docs/agents/issues/` folder. |
| [`/plan-issue`](plan-issue/) | Reads an issue file, analyzes the codebase, and writes a structured implementation plan in `docs/agents/plans/`. |
| [`/fix-issue`](fix-issue/) | Reads an issue and its plan, then opens a pull request to fix it. |
| [`/helloworld`](helloworld/) | Responds with a greeting message. |

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
