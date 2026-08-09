# Plan: Add script to install

Issue: [114-add-script-to-install.md](../issues/114-add-script-to-install.md)

## Overview

Add a `curl | bash` install path for arcanum as an alternative to `git clone`. A minimal bootstrap script (fetched raw from GitHub) resolves a version and repo (fork-aware via `ARCANUM_REPO`/`ARCANUM_VERSION`), downloads that release's trimmed zip, and hands off to a versioned installer bundled inside it. A new CircleCI pipeline builds that trimmed zip on tag push and publishes it as a GitHub Release asset. This requires moving the shared `_lib/` under a new `arcanum/` folder so the release zip is self-contained without dragging in dev-only files.

## Context

Today, using arcanum requires `git clone` into `~/.claude/skills`. The repo mixes runtime-relevant files (skill folders, shared `_lib`) with dev-only files (`AGENTS.md`, `.claude/`, `docs/`, `.github/`, `ISSUE_TEMPLATE.md`) that have no reason to be installed for end users. There is no CI config of any kind in the repo today (no `.circleci/`, no `.github/workflows/`), and no `bump-version.sh` — both are net-new.

## Implementation Steps

### Step 1 — Repo reorganization: `_lib/` → `arcanum/_lib/`

Move `_lib/` to `arcanum/_lib/` (git mv). Skill folders themselves (`enhance-issue/`, `discuss-issue/`, etc.) stay at the repo root, untouched, so `/skill-name` discovery is unaffected.

Update every reference to the old path:
- All `../../_lib/...` `source`/`exec` calls across skill scripts (~26 files — see "Files to Change").
- `# shellcheck source=../../_lib/...` comment paths in the same files.
- Internal comment-only mentions inside `_lib/*.sh` itself (e.g. `_lib/tag_actions.sh`, `_lib/tag_mutate.sh`, `_lib/test_origin_resolution.sh` reference `_lib/tags.sh`/`_lib/origin.sh` in prose comments) — update to `arcanum/_lib/...` for accuracy, even though these are same-directory siblings and don't need a path change to function.
- `docs/agents/architecture.md` and `docs/agents/folder-structure.md` — update any mention of `_lib/` to `arcanum/_lib/`.

This is scoped, mechanical, per-file work — a good fit for the `scripter` agent (each edit lives inside a `<skill>/scripts/` file), with the `_lib` move itself and doc updates handled by the architect.

### Step 2 — `arcanum.version` marker file

Add `arcanum.version` at the repo root, containing just the current version string. Used by the installer stage to detect an existing install (see issue's "Already-installed detection").

### Step 3 — Bootstrap script (`arcanum/install/bootstrap.sh`)

New script, fetched directly via `curl <raw-url> | bash` (raw URL built from `ARCANUM_REPO`, default `darthjee/arcanum`, against the `main` branch — always the latest bootstrap logic regardless of which release version it's about to install). Responsibilities only:

1. Resolve `ARCANUM_REPO` (default `darthjee/arcanum`) and `ARCANUM_VERSION` (default: a version string baked into this script at release time via `bump-version.sh`).
2. Download the release zip from `https://github.com/$ARCANUM_REPO/releases/download/$ARCANUM_VERSION/<asset-name>.zip` (exact asset name to match whatever Step 5's build script produces).
3. Unzip to a temp directory.
4. Exec `arcanum/install/installer.sh` from inside the unzipped tree, handing off control. Nothing else.

Keep this script small and easy to read in a few seconds — it's the only part of the flow executed blindly.

### Step 4 — Installer script (`arcanum/install/installer.sh`)

Ships inside the release zip (and in a full git clone, alongside it), versioned with the release. Responsibilities:

1. Check the target directory (see prompt below) for an existing `arcanum.version`. If found, print an error explaining an install already exists and exit non-zero — no overwrite, no update flow (future work).
2. Prompt interactively for the target directory:
   - Press Enter → default `~/.claude/skills`.
   - Otherwise → current folder or a typed custom path.
   - Any non-default choice triggers a confirmation prompt (press Enter to confirm) before proceeding.
   - Must read prompts from `/dev/tty` explicitly, since stdin under `curl | bash` is the piped script content, not the terminal.
3. Copy the skill folders and `arcanum/` (containing `arcanum/_lib` and `arcanum.version`) into the confirmed target directory.

### Step 5 — Release build script + CircleCI pipeline

Add `scripts/build_release_zip.sh` (new top-level `scripts/` folder — **dev-only tooling, not shipped in the release zip itself**, distinct from `arcanum/install/` which does ship). It assembles a zip containing: every skill folder, `arcanum/` (with `arcanum/_lib` and `arcanum/install`), and `arcanum.version` — explicitly excluding `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, `.github/`, `ISSUE_TEMPLATE.md`, `.gitignore`, `.git/`, and the new dev-only `scripts/` folder itself.

Add `.circleci/config.yml`: one job, triggered only on tag pushes matching the existing semver convention (e.g. `0.9.10`, no `v` prefix). The job:
1. Runs `scripts/build_release_zip.sh` to produce the zip.
2. Creates a GitHub Release for the pushed tag (if not already present) and uploads the zip as a release asset, using a GitHub token configured as a CircleCI env var/context.

### Step 6 — `scripts/bump-version.sh`

New dev-only script (repo root `scripts/`, doesn't exist yet). On invocation with a new version string, updates:
1. `arcanum.version` at the repo root.
2. The baked-in default `ARCANUM_VERSION` constant inside `arcanum/install/bootstrap.sh`.

### Step 7 — README updates

Add the `curl | bash` one-liner as an install option in `README.md`, alongside the existing `git clone` instructions — both remain valid, equally documented.

## Files to Change

- `_lib/*` → `arcanum/_lib/*` — moved (git mv), 12 files.
- `arcanum/install/bootstrap.sh` — new.
- `arcanum/install/installer.sh` — new.
- `arcanum.version` — new.
- `scripts/build_release_zip.sh` — new.
- `scripts/bump-version.sh` — new.
- `.circleci/config.yml` — new.
- `README.md` — add install one-liner section.
- `docs/agents/architecture.md`, `docs/agents/folder-structure.md` — update `_lib/` mentions to `arcanum/_lib/`.
- The following files' `_lib` references (`source`/`exec` paths and `shellcheck source=` comments) update from `../../_lib/...` to `../../arcanum/_lib/...`:
  - `auto-fix-all/scripts/{checkout_from_main,cleanup_artifacts,config,github,queue,reply_comment,wait_ci}.sh`
  - `auto-fix-issue/scripts/{commit_change,github,issue_state,merge_main,resolve_plan_paths}.sh`
  - `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`
  - `auto-monitor-pr/scripts/monitor_pr.sh`
  - `auto-new-issue/scripts/{commit_issue,github,resolve_id_and_file}.sh`
  - `auto-plan-issue/scripts/{commit_plan,resolve_plan_paths}.sh`
  - `discuss-issue/scripts/{github,resolve_id_and_file}.sh`
  - `enhance-issue/scripts/github.sh`
  - `init-claude/scripts/sync_labels.sh`
  - `monitor-issues/scripts/{config,github,monitor_issues,rewrite_queue}.sh`
  - `_lib/{tag_actions,tag_mutate,test_origin_resolution}.sh` — comment-only mentions.

## CI Checks

None yet — this issue introduces the repo's first CI config. No existing check to run locally against these changes.

## Notes

- Testing strategy for the install/bootstrap scripts and the CircleCI pipeline is explicitly deferred to future work (per the issue) — not detailed here.
- An update/upgrade flow (re-running the installer against an existing install) is explicitly deferred to future work — current behavior is refuse-and-exit.
- Open implementation detail, not pinned down by the issue: the initial value to seed `arcanum.version` with (e.g. matching README's current "Next Release" version, or a placeholder) before the first tag built by this new pipeline exists.
- The exact release zip asset naming scheme (used to build the download URL in `bootstrap.sh`) is left to implementation — keep it predictable and derivable from `$ARCANUM_VERSION` alone.
- No integrity/checksum verification of the downloaded zip (relies on HTTPS + GitHub trust) — decided during discussion, not a gap to fill in.
- Assumes `curl`, `unzip`/`tar`, and `bash` are available on the installing machine; no fallback for their absence beyond a clear error.
