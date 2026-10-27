# Arcanum

A collection of Claude Code skills — reusable slash commands that extend Claude Code with project workflows.

[![Build Status](https://circleci.com/gh/darthjee/arcanum.svg?style=shield)](https://circleci.com/gh/darthjee/arcanum)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/9749726787d24c7cadc8bf82f0dd1d53)](https://app.codacy.com/gh/darthjee/arcanum/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/9749726787d24c7cadc8bf82f0dd1d53)](https://app.codacy.com/gh/darthjee/arcanum/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

![arcanum](https://raw.githubusercontent.com/darthjee/arcanum/master/arcanum.png)

**Current Version:** [2.2.3](https://github.com/darthjee/arcanum/releases/tag/2.2.3)
**Next Release:** [2.2.4](https://github.com/darthjee/arcanum/compare/2.2.3...main)

## What are skills?

Skills are prompt files that Claude Code loads as slash commands. Each skill lives in its own folder under the repository root and is activated by typing `/skill-name` in Claude Code.

## Available skills

| Skill | Description |
| --- | --- |
| [`/init-claude`](init-claude/) | Initializes a project's AI configuration: creates or consolidates `CLAUDE.md`, `.github/copilot-instructions.md`, and `AGENTS.md`, then scaffolds `docs/agents/` with architecture, folder structure, and contributing guides. |
| [`/arcanum-split-issue`](arcanum-split-issue/) | Breaks a single GitHub issue into several sub-issues through interactive dialogue, generating one local draft file per sub-issue, then pushing each as a real GitHub issue linked to the parent via GitHub's native sub-issue relationship. |
| [`/arcanum-create-issue`](arcanum-create-issue/) | Creates a brand-new GitHub issue through a guided interview: starts or resumes a local draft, runs the same checklist dialogue as `/enhance-issue`, picks the labels (and whether it is an `Epic`), then creates the labeled issue and offers `/arcanum-split-issue` for Epics or `/discuss-issue` otherwise. |
| [`/enhance-issue`](enhance-issue/) | Iteratively flesh out a still-vague GitHub issue idea (tagged `Idea`/`Writting`) through checklist-driven dialogue, before it's mature enough for `/discuss-issue`. |
| [`/discuss-issue`](discuss-issue/) | Discusses and refines an existing GitHub issue through iterative dialogue, optionally spawning specialist agents to deepen understanding, then saves it and, on confirmation, kicks off planning on a committed branch. |
| [`/plan-issue`](plan-issue/) | Reads an issue file, analyzes the codebase, and writes a structured implementation plan in `docs/agents/plans/`. |
| [`/auto-fix-all`](auto-fix-all/) | Autonomously runs the full pipeline (new issue → plan → fix → monitor) for a queue of issue IDs, one at a time, reacting to PR comments, approvals, CI failures, and closes until every issue is merged or skipped. |
| [`/auto-new-issue`](auto-new-issue/) | Autonomously creates a new issue file with no user interaction, then commits it and syncs it to GitHub. |
| [`/auto-plan-issue`](auto-plan-issue/) | Autonomously writes an implementation plan with no user interaction, splitting it across the target project's specialist agents when any are configured, then commits it. |
| [`/auto-resolve-issue`](auto-resolve-issue/) | Autonomously takes a single issue through the full pipeline (new issue → plan → fix → PR → monitor → merge), with no queue. Run it via `/loop /auto-resolve-issue <id>` so it can reschedule itself while the PR is pending. |
| [`/auto-fix-issue`](auto-fix-issue/) | Autonomously implements a planned issue with no user interaction, dispatching the plan's specialist agents in parallel, reviewing and re-dispatching until correct, then opening or marking ready a pull request. |
| [`/auto-monitor-pr`](auto-monitor-pr/) | Monitors a given PR for merge/close/approval/new owner comments, blocking until one of those occurs, then reports the outcome. Tracks each owner comment's open/addressed lifecycle with :eyes:/:+1: reactions on the comment itself, but leaves deciding how to address a comment to the caller. |
| [`/auto-monitor-issue-pr`](auto-monitor-issue-pr/) | Resolves the PR for an issue's currently checked-out branch, then monitors it for merge/close/approval/new owner comments, blocking until one of those occurs. Used by the per-issue pipeline of `auto-resolve-issue` and `auto-fix-all`. |
| [`/push-issue-to-queue`](push-issue-to-queue/) | Pushes one or more issue IDs onto the end of the `auto-fix-all` queue, to be processed later. |
| [`/auto-rewrite-issue`](auto-rewrite-issue/) | Autonomously drains the `monitor-issues` rewrite queue, rewriting each queued issue's body with no user interaction and removing its `created` tag once pushed. |
| [`/arcanum-update`](arcanum-update/) | Updates this arcanum install to the latest (or a pinned) release from inside a Claude Code session — asks for explicit confirmation naming the repo and update method (zip download vs. git fetch/checkout), then streams the update's own progress output. |
| [`/arcanum-migrate`](arcanum-migrate/) | Walks this repo through pending per-repo structural changes introduced by newer arcanum versions (renamed/moved config files, new config shapes) — distinct from `/arcanum-update`, which updates the arcanum install itself, not artifacts inside the consuming repo. Lists pending migrations, asks for confirmation ([A]ll/[N]one/[S]elect), then applies them. |
| [`/arcanum-check-config`](arcanum-check-config/) | Shows, as JSON, what each arcanum config tier (local state → repo config → global config) holds for a key, including shadowed tiers, plus the final resolved value and the tier it came from. Read-only. Usage: `/arcanum-check-config git.authors`. |

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

Before downloading anything, the script prints the resolved repo/version/URL and asks for an explicit y/N confirmation (reads from `/dev/tty`). Set `ARCANUM_ASSUME_YES=1` to skip that prompt for unattended/CI use — meant as a one-off prefix on the command itself, not something to `export` permanently.

Once arcanum is installed, a separate prompt offers the [Arcanum CLI](#arcanum-cli), pinned to the arcanum version just installed:

```text
Install arcanum-cli@<version> globally (npm i -g)? [Y/n]
```

It defaults to yes and also reads from `/dev/tty`. `ARCANUM_ASSUME_YES` does **not** answer it: it only skips the arcanum confirmation above. To skip the client step entirely, without asking and without calling `node` or `npm`, set `ARCANUM_SKIP_CLI=1`, again as a one-off prefix on the command:

```bash
curl -fsSL https://raw.githubusercontent.com/darthjee/arcanum/main/arcanum/install/bootstrap.sh | ARCANUM_SKIP_CLI=1 bash
```

The client step needs Node.js 22.13.0 or newer and npm. It never fails the arcanum install: with no TTY, if you answer no, or if anything goes wrong (no Node or npm, Node too old, the version not published on npm, `EACCES` on the npm global prefix, a network error), it prints a warning naming the manual `npm i -g arcanum-cli` command and the install still succeeds. It never retries with `sudo`. If `arcanum-cli` is already installed globally, an older copy is offered an update to the target version (`Update arcanum-cli <old> → <version> (npm i -g)? [Y/n]`), while the same version, a newer one, or an `npm link`ed checkout is left as is.

### Option 2 — `git clone`

Clone this repository into your Claude Code skills directory:

```bash
git clone git@github.com:darthjee/arcanum.git ~/.claude/skills
```

A clone does not install the [Arcanum CLI](#arcanum-cli). Install it with `npm i -g arcanum-cli`, or accept the global migration the next time you run `/arcanum-migrate` (see the one-time note under [Updating](#updating)).

Both options lay down the same skill folders. Claude Code automatically discovers skills from that directory.

## Updating

Brings an existing install up to date with a newer release. For a `curl | bash` (zip-tracked) install: adds new files, overwrites changed ones, and removes files no longer part of the release, without touching anything else in the install directory. For a `git clone` install: `git fetch --tags` then `git checkout` onto the resolved release tag (detached HEAD).

From inside a Claude Code session, run `/arcanum-update` instead of any of the below — see the skills table above.

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

Before doing anything, the script prints the resolved repo/version/method (release-zip download vs. `git fetch`/`git checkout`, detected automatically) and asks for an explicit y/N confirmation (reads from `/dev/tty`). Set `ARCANUM_ASSUME_YES=1` to skip that prompt for unattended/CI use — a one-off prefix on the command itself, not something to `export` permanently.

A `git clone` install with uncommitted local changes fails fast with a message to commit/stash/discard first — no auto-stash, no checkout over local work.

After the update, both methods (release zip and `git fetch`/`git checkout`) run the same client step as the installer: a `[Y/n]` prompt to install or update `arcanum-cli` to the version you just updated to, with the same rules — `ARCANUM_SKIP_CLI=1` skips it, `ARCANUM_ASSUME_YES` does not answer it, and with no TTY or on any failure it warns with the manual command while the update still succeeds. An older installed client is updated to the target version; a newer or `npm link`ed one is left as is. When arcanum is already on the target version, the update is a no-op and the client step does not run. `/arcanum-update` asks the same question in chat, since a Claude Code session has no TTY.

**One-time note for `git clone` installs.** The first update after the release that added the client step still runs your old `bootstrap.sh`, which has no client step, so that update does not offer the CLI. Run `npm i -g arcanum-cli` once, or accept the global migration `arcanum/migrations/repos/next/001.sh` in `/arcanum-migrate`: choosing `[R]un` there is the consent to install or update the client, and `[S]kip` is remembered. Later updates offer the CLI as described above.

## The `arcanum-next-step` mod

Arcanum ships a small Claude Code mod, [`arcanum-next-step/`](arcanum-next-step/), next to its skills. It gives skills one tool, `mcp__arcanum-next-step__handoff`. When a skill calls it, the mod waits for the current turn to end, then runs `/clear` and the next arcanum skill command. This is the only way a skill can start its next step from a clean context. The mod only accepts arcanum skill commands (`/<skill> ...` or `/loop /<skill> ...`).

- **Ships and loads with arcanum:** the release zip, `curl | bash`, `git clone` and `/arcanum-update` all bring it in. Claude Code loads it automatically from a skills folder (`~/.claude/skills/`, `$CLAUDE_CONFIG_DIR/skills/` or a project's `.claude/skills/`), in new sessions.
- **Used at automatic hops:** skills call it when an automatic next-step hop also has its `next_step.clear.<skill>` key set to `true` (see [Clearing](docs/agents/architecture/skill-finish.md#clearing)).
- **Used by unattended loops:** `auto-fix-all` and `monitor-issues` call it between iterations when their `clear_context` toggle is on, handing off `/loop /auto-fix-all` or `/loop /monitor-issues`.
- **Custom install path:** if arcanum is installed outside a skills folder, the mod is not loaded. Skills then schedule the next command about a minute ahead and ask you to type `/clear` in the meantime; if that is not possible either, they run it without clearing context. `auto-fix-all` and `monitor-issues` skip the "type `/clear`" step: they print `clear skipped: <reason>` and restart through a 60-second wakeup that keeps context.
- **Interactive sessions only:** under `claude -p` or an SDK host, the tool is not registered.

See [`arcanum-next-step/README.md`](arcanum-next-step/README.md) for the tool contract, opting out and development notes.

## Skill structure

Each skill is a folder containing a `SKILL.md` entry point and optional auxiliary markdown files:

```text
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

## Configuration

Arcanum configuration keys are resolved through a 3-tier chain, in order of precedence — the first non-null value found wins, mirroring git's own `--local` > `--global` > `--system` precedence:

1. **Local** — `.claude/state/arcanum-config.json` (per-checkout, gitignored)
2. **Repo** — `.claude/configuration/arcanum-repo-config.json` (committed, shared across the team)
3. **Global** — `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (cross-project, scoped to your Claude Code account)

| Key | Description |
| --- | --- |
| `git.merge_body_mode` | Controls the squash-merge commit body (`empty`, `full`, or `coauthors`). |
| `git.omit_model_coauthor` | When `true`, removes the model's email from the coauthors list during merge. |
| `git.remove_coauthors` | List of emails to remove from the coauthors list during merge. |
| `git.agents.<agent>.email` | Commit author email per agent, supports the `{agent}` placeholder. |
| `git.email` | Global fallback email for agents without a specific email configured. |
| `git.safe_branch` | Reference branch for safe fetch/merge operations (default: `origin/main`). |
| `engine.mode` | Defines which implementation to run for migrated entrypoints (`shell`, `native`, or `docker`). |
| `auto-fix-all.clear_context` | Clears context between issues in the `auto-fix-all` pipeline through the `arcanum-next-step` mod (run via `/loop`); without the mod, restarts via a wakeup that keeps context. |
| `auto-fix-all.finish_on_empty_queue` | Finishes the pipeline when the issue queue is empty. |
| `auto-fix-all.ignored_check_patterns` | CI check name patterns to ignore when deciding pass/fail. |
| `monitor-issues.clear_context` | Clears context between `monitor-issues` cycles through the `arcanum-next-step` mod (run via `/loop`); without the mod, restarts via a wakeup that keeps context. |
| `plan-issues.max-retry-count` | Max retries for GitHub issue creation in `arcanum/_lib/spawn_issue.sh` (default: 5). |
| `plan-issues.error-sleep-time` | Seconds to sleep between retries in `arcanum/_lib/spawn_issue.sh` (default: 5). |
| `next_step.auto.enhance-issue` | When `true`, skips `enhance-issue`'s `/discuss-issue` offer and runs it automatically (default: `false`). |
| `next_step.auto.discuss-issue` | When `true`, skips `discuss-issue`'s `/auto-plan-issue` offer and runs it automatically (default: `false`). |
| `next_step.auto.auto-plan-issue` | When `true`, skips the `/loop /auto-resolve-issue` offer made once a plan exists and runs it automatically (default: `false`). |

The `next_step.auto.<skill>` keys can be set through `/init-claude` (writes repo config) or `/arcanum-migrate` (one skippable migration per tier: local, repo, global), or from a terminal with `arcanum config next-step auto <skill> on` (or the `arcanum config setup flow` wizard) — see [Arcanum CLI](#arcanum-cli) below.

**Example, showing every key together:**

```json
{
  "git": {
    "merge_body_mode": "coauthors",
    "omit_model_coauthor": true,
    "remove_coauthors": ["noreply@anthropic.com"],
    "agents": {
      "architect": { "email": "you+architect@example.com" }
    },
    "email": "you+{agent}@example.com",
    "safe_branch": "origin/main"
  },
  "engine": {
    "mode": "shell"
  },
  "auto-fix-all": {
    "clear_context": false,
    "finish_on_empty_queue": false,
    "ignored_check_patterns": []
  },
  "monitor-issues": {
    "clear_context": false
  },
  "plan-issues": {
    "max-retry-count": 5,
    "error-sleep-time": 5
  },
  "next_step": {
    "auto": {
      "enhance-issue": false,
      "discuss-issue": false,
      "auto-plan-issue": false
    }
  }
}
```

## Arcanum CLI

The `arcanum` CLI reads and writes these settings from a terminal, without hand-editing the JSON files. Values of known keys are validated, and writes take the same lock as the skills' own writes. It needs Node.js 22.13.0 or newer. The arcanum [installer](#installation) and [updater](#updating) offer to install or update it at the matching version; to install it on its own, use npm:

```bash
npm i -g arcanum-cli
```

`arcanum self-update` updates it later to the latest release.

A few examples:

```bash
arcanum config info             # which files and tiers are in effect here
arcanum config setup            # interactive wizard over the common settings
arcanum config engine native    # shortcut for: config set engine.mode native --local
```

See the [Arcanum CLI user guide](docs/guides/arcanum-cli.md) for every command, shortcut and flag, and [`cli/README.md`](cli/README.md) for the package's own reference page.
