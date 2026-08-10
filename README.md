# Arcanum

A collection of Claude Code skills — reusable slash commands that extend Claude Code with project workflows.

![arcanum](https://raw.githubusercontent.com/darthjee/arcanum/master/arcanum.png)

**Current Version:** [0.8.0](https://github.com/darthjee/arcanum/releases/tag/0.9.0)

**Next Release:** [0.8.1](https://github.com/darthjee/arcanum/compare/0.9.0...main)

## What are skills?

Skills are prompt files that Claude Code loads as slash commands. Each skill lives in its own folder under the repository root and is activated by typing `/skill-name` in Claude Code.

## Available skills

| Skill | Description |
|-------|-------------|
| [`/init-claude`](init-claude/) | Initializes a project's AI configuration: creates or consolidates `CLAUDE.md`, `.github/copilot-instructions.md`, and `AGENTS.md`, then scaffolds `docs/agents/` with architecture, folder structure, and contributing guides. |
| [`/enhance-issue`](enhance-issue/) | Iteratively flesh out a still-vague GitHub issue idea (tagged `Idea`/`Writting`) through checklist-driven dialogue, before it's mature enough for `/discuss-issue`. |
| [`/discuss-issue`](discuss-issue/) | Discusses and refines an existing GitHub issue through iterative dialogue, optionally spawning specialist agents to deepen understanding, then saves it and, on confirmation, kicks off planning on a committed branch. |
| [`/plan-issue`](plan-issue/) | Reads an issue file, analyzes the codebase, and writes a structured implementation plan in `docs/agents/plans/`. |
| [`/auto-fix-all`](auto-fix-all/) | Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, reacting to PR comments, approvals, CI failures, and closes until every issue is merged or skipped. |
| [`/auto-new-issue`](auto-new-issue/) | Autonomously creates a new issue file with no user interaction, then commits it and syncs it to GitHub. |
| [`/auto-plan-issue`](auto-plan-issue/) | Autonomously writes an implementation plan with no user interaction, splitting it across the target project's specialist agents when any are configured, then commits it. |
| [`/auto-fix-issue`](auto-fix-issue/) | Autonomously implements a planned issue with no user interaction, dispatching the plan's specialist agents in parallel, reviewing and re-dispatching until correct, then opening or marking ready a pull request. |
| [`/auto-monitor-pr`](auto-monitor-pr/) | Monitors a given PR for merge/close/approval/new owner comments, blocking until one of those occurs, then reports the outcome. Tracks each owner comment's open/addressed lifecycle with :eyes:/:+1: reactions on the comment itself, but leaves deciding how to address a comment to the caller. |
| [`/auto-monitor-issue-pr`](auto-monitor-issue-pr/) | Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by `auto-fix-all`. |
| [`/push-issue-to-queue`](push-issue-to-queue/) | Pushes one or more issue IDs onto the end of the `auto-fix-all` queue, to be processed later. |
| [`/auto-rewrite-issue`](auto-rewrite-issue/) | Autonomously drains the `monitor-issues` rewrite queue, rewriting each queued issue's body with no user interaction and removing its `created` tag once pushed. |

## Installation

### Option 1 — `curl | bash`

Install without cloning a git repository, by downloading a trimmed release zip:

```bash
curl -fsSL https://raw.githubusercontent.com/darthjee/arcanum/main/arcanum/install/bootstrap.sh | bash
```

This fetches the latest known release, unzips it, and hands off to an interactive installer that prompts for the target directory (defaults to `~/.claude/skills`; press Enter to accept, or type another path). It refuses to overwrite a directory that already has an existing arcanum install — pointing you at `update` instead (see below).

To target a fork, or pin a specific version:

```bash
ARCANUM_REPO=your-fork/arcanum ARCANUM_VERSION=0.8.1 curl -fsSL https://raw.githubusercontent.com/your-fork/arcanum/main/arcanum/install/bootstrap.sh | bash
```

### Option 2 — `git clone`

Clone this repository into your Claude Code skills directory:

```bash
git clone git@github.com:darthjee/arcanum.git ~/.claude/skills
```

Both options lay down the same skill folders. Claude Code automatically discovers skills from that directory.

## Updating

Brings an existing `curl | bash` install up to date with a newer release — adds new files, overwrites changed ones, and removes files no longer part of the release, without touching anything else in the install directory.

The common case — run the copy already sitting inside your install, no flags needed:

```bash
bash ~/.claude/skills/arcanum/update/bootstrap.sh
```

Or fetch fresh via `curl | bash` (useful when there's no local checkout to run from, or to override the target/version/repo explicitly):

```bash
curl -fsSL https://raw.githubusercontent.com/darthjee/arcanum/main/arcanum/update/bootstrap.sh | bash
```

Defaults to the latest published release, and to the same repo (including forks) the install originally came from. Override either with `ARCANUM_VERSION`/`ARCANUM_REPO`, and set `ARCANUM_TARGET` when piping via `curl | bash` with no local install to infer the target from:

```bash
ARCANUM_REPO=your-fork/arcanum ARCANUM_VERSION=0.9.0 ARCANUM_TARGET=~/.claude/skills \
  curl -fsSL https://raw.githubusercontent.com/your-fork/arcanum/main/arcanum/update/bootstrap.sh | bash
```

`git clone` installs update the usual git way (`git fetch && git checkout <tag>`, or `git pull`) — no separate update script needed for that path.

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
