# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `auto-new-issue/` | Skill `/auto-new-issue` — autonomously creates a new issue file (no user interaction), committing and syncing with GitHub automatically. |
| `auto-plan-issue/` | Skill `/auto-plan-issue` — autonomously writes an issue's implementation plan, splitting across specialist agents when there are any. |
| `auto-fix-issue/` | Skill `/auto-fix-issue` — autonomously implements a planned issue, dispatching specialist agents in parallel and opening/marking the PR ready. |
| `auto-fix-all/` | Skill `/auto-fix-all` — orchestrates the full pipeline (issue → plan → fix → monitoring) for a queue of IDs, one at a time, reacting to comments, approvals, CI failures, and PR closures until the queue is empty. |
| `init-claude/` | Skill `/init-claude` — sets up AGENTS.md/CLAUDE.md/copilot-instructions.md and the project's docs structure. |
| `arcanum-split-issue/` | Skill `/arcanum-split-issue` — breaks a broad issue into several sub-issues through interactive dialogue, generates one local file per sub-issue, then publishes each one as a real GitHub issue, linked to the parent issue via GitHub's native sub-issue relationship. |
| `new-issue/` | Skill `/new-issue` — creates a new issue file. |
| `enhance-issue/` | Skill `/enhance-issue` — helps the user mature a still-vague issue idea (tag `Idea`/`Writting`) through dialogue guided by a checklist of concerns, before publishing it as `Created`. |
| `plan-issue/` | Skill `/plan-issue` — creates the implementation plan for an existing issue. |
| `push-issue-to-queue/` | Skill `/push-issue-to-queue` — adds one or more issue ids to the end of `auto-fix-all`'s queue. |
| `auto-rewrite-issue/` | Skill `/auto-rewrite-issue` — drains `monitor-issues`' rewrite queue, autonomously rewriting the body of each issue tagged `created` and removing the tag at the end. |
| `arcanum-migrate/` | Skill `/arcanum-migrate` — updates a repository that already has arcanum installed with the structural changes (renamed/moved files, new config formats) introduced by newer arcanum versions, via `arcanum/migrations/` (see `docs/agents/architecture/per-repo-migrations.md`). Different from `/arcanum-update`, which updates arcanum's own installation, not artifacts inside the consumer repository. |
| `core/` | Node.js package holding migrated skill entrypoint logic (native counterpart of `<skill>/scripts/*.sh`/`arcanum/_lib/*.sh` per `docs/agents/architecture/script-engine.md`), owned by the `node` specialist agent. Yarn-managed, ESM, zero runtime npm dependencies; `core/lib/` (source) mirrored 1:1 by `core/spec/` (Jasmine specs), `core/bin/arcanum` (the centralized native entrypoint), `core/eslint.config.mjs`. `core/Dockerfile`/`core/docker-compose.yml` (the `darthjee/node`-based test image) are owned by `infra` instead — see the root `Makefile`'s `core-*` targets. |
| `Makefile` | Development tooling invoked from the repo root — currently the `core-*` targets that build/run `core/`'s test image (owned by `infra`; see `core/docker-compose.yml`). |
| `arcanum/` | Content packaged in the release zip and installed by the `curl \| bash` flow (see `docs/agents/architecture/install-and-release.md`), and also used equally by anyone doing `git clone`. Contains `arcanum/_lib/` (shared script library, formerly `_lib/` at the root), `arcanum/install/` (`bootstrap.sh` and `installer.sh`, the installation flow's scripts), `arcanum/update/` (`bootstrap.sh` and `updater.sh`, the update flow's scripts for an existing installation), and `arcanum/migrations/` (runner + `repos/<version>/NNN.sh` — per-repository migrations applied via `/arcanum-migrate`). |
| `arcanum.version` | Lives at the repository root, used only at build/release time: `scripts/build_release_zip.sh` reads the version from here and `scripts/bump-version.sh` updates it. No longer copied into the release zip nor read by installations — replaced in that role by `arcanum.json`, written dynamically by `installer.sh`/`updater.sh` at the root of the installed tree (clone or zip), containing `version`, `repo` (so fork installations keep updating from the fork itself) and `manifest` (list of tracked paths, used to compute removals on `update`). |
| `scripts/` | This repository's own development tools, not included in the release zip: `build_release_zip.sh` (assembles the release zip, including the `MANIFEST` file embedded at the zip's root) and `bump-version.sh` (updates `arcanum.version` and the default version embedded in `arcanum/install/bootstrap.sh`). |
| `.circleci/` | Release pipeline: on a semver tag push, builds the release zip via `scripts/build_release_zip.sh` and publishes it as a GitHub Release asset. |
| `docs/agents/` | This repository's own documentation (architecture, flow, issues, plans). |
| `docs/guides/` | The only subdirectory of `docs/` included in the release zip (see `scripts/build_release_zip.sh`) — guides aimed at the end user of a repository that has installed arcanum, e.g. `arcanum-repo-config.md` and `arcanum-repo-version.md`, referenced by the scripts' own fallback/error warnings. |
| `.github/` | Contains `copilot-instructions.md`, which points to AGENTS.md. |
| `.claude/` | Local Claude Code configuration for this repository. Contains subfolders for runtime state and skill configuration. |
| `.claude/state/` | Runtime state files: queue JSON (`auto-fix-all-queue.json`), queue lock (`auto-fix-all-queue.lock`), per-PR comment tracking (`auto-monitor-pr-<pr_number>-comments.json`), rewrite queue JSON/lock (`monitor-issues-rewrite-queue.json`/`.lock`). In a repo initialized by `init-claude`, also holds `init-claude-config.json` (the label/color table synced by `setup_labels.md`). |
| `.claude/configuration/` | Skill configuration files: e.g. `arcanum-repo-config.json` (namespaced, arcanum-wide config — controls `auto-fix-all`'s ignored CI check patterns under its own key, plus the repo's tracked arcanum `.version`; `auto-fix-all.json` is the legacy, pre-namespacing fallback — see `docs/guides/arcanum-repo-config.md`). |
| `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | Global, cross-project config — **outside** the repository, unlike every row above; scoped to the active Claude Code account/profile. It's the outermost layer of arcanum's config resolution chain (local repo state -> repo config -> global user config -> hardcoded default), consulted only when neither repo-scoped file has a value — see `docs/agents/architecture/shared-state-and-configuration.md` and `docs/guides/arcanum-global-config.md`. |
| `AGENTS.md` | Shared project instructions. |
| `CLAUDE.md` | Points to AGENTS.md. |
| `README.md` | Repository overview and table of available skills. |

Each skill folder follows the `SKILL.md` (+ optional auxiliary files) structure, already described in `docs/agents/architecture/overview-and-layout.md`.
