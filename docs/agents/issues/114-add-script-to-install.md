# Issue: Add script to install

## Description

Today, using arcanum requires cloning the full repository into `~/.claude/skills` — cumbersome for users who don't want a git repository there, or who already have one for something else. This issue adds a `curl | bash` install path: a public one-liner that downloads a trimmed, versioned release zip and lays it down as skills, as an alternative to `git clone` (which must keep working unchanged).

The work has two parts, shipped together as one coherent unit:

1. An install script (`arcanum/install/`) fetched and run via `curl | bash`.
2. A CircleCI pipeline that, on tag push, builds a trimmed release zip (excluding dev-only files like `AGENTS.md`, `.claude/`, `docs/`) and publishes it as a GitHub Release asset for the install script to target.

## Problem

- Requiring a full git clone into `~/.claude/skills` is cumbersome for users without a git repo there, or who already have an unrelated one.
- The repository mixes runtime-relevant files (skills, shared `_lib`) with dev-only files (`AGENTS.md`, `.claude/`, `docs/`, `.github/`, `ISSUE_TEMPLATE.md`) meant only for developing arcanum itself, which have no reason to be installed for end users.

## Expected Behavior

Running the published one-liner (e.g. `ARCANUM_REPO=darthjee/arcanum curl <bootstrap-url> | bash`, optionally with `ARCANUM_VERSION=<tag>` to pin a version):

1. The bootstrap script resolves the target repo from `ARCANUM_REPO` (defaulting to `darthjee/arcanum`, but usable against any fork), resolves the version (pinned via `ARCANUM_VERSION`, or the default baked in at release time), downloads that release's trimmed zip from its GitHub Release asset, and unzips it to a temp location. It does nothing else.
2. Control hands off to the installer script bundled inside the downloaded zip (`arcanum/install/`), which:
   - Prompts for the target directory: press Enter to accept the default (`~/.claude/skills`), or choose the current folder or type a custom path instead. Any non-default choice becomes the new proposed target and requires a confirmation prompt (press Enter to confirm) before proceeding.
   - Checks the target directory for an existing `arcanum.version` file. If found, it refuses to proceed and tells the user to remove the existing install manually first (no update flow yet — future work).
   - Otherwise, places the skill folders and `arcanum/` (containing `_lib` and `arcanum.version`) into the target directory.
3. Users who prefer `git clone` into `~/.claude/skills` continue to get the exact same result, unchanged.
4. `README.md` documents the new one-liner as an alternative to `git clone`, alongside the existing clone instructions.

## Solution

**Two-stage install architecture**

1. **Bootstrap stage** — the tiny script fetched directly by `curl | bash`. Its only job: resolve the version, download that release's zip, unzip it. Kept minimal so it's easy to read/audit before piping into `bash`.
2. **Installer stage** — lives inside the downloaded zip (`arcanum/install/`), versioned together with the release it installs. Owns all the heavier logic: target-directory prompt/confirmation, existing-install check, file placement.

**Version resolution**

- The bootstrap script has a "latest known" version baked in at release time.
- `scripts/bump-version.sh` (new — doesn't exist in the repo yet) is extended to also update that baked-in version reference in the bootstrap script, and to bump `arcanum.version` at the repo root.
- `ARCANUM_VERSION` env var lets a user pin an explicit version instead.
- `ARCANUM_REPO` env var (default `darthjee/arcanum`) drives the actual download URLs, so the bootstrap script genuinely works against any fork, not just the canonical repo.

**Already-installed detection**

- `arcanum.version` ships at the root of the installed tree. The installer stage refuses to proceed if it finds one already at the target — no silent overwrite. An update/upgrade flow is explicitly future work.

**Interactivity note**

- Since the bootstrap script's stdin is the piped script content (not the terminal) under `curl | bash`, the installer stage needs to read its prompts from `/dev/tty` explicitly for the interactive target-directory flow to work.

**Repo reorganization**

- Root `_lib/` moves to `arcanum/_lib/`; new install scripts live at `arcanum/install/`. Skill folders (`enhance-issue/`, `discuss-issue/`, etc.) stay directly at the repo root, untouched, so Claude Code's skill discovery is unaffected.
- All `../../_lib/...` references across skill scripts (~20+ occurrences, e.g. `auto-new-issue/scripts/commit_issue.sh`, `monitor-issues/scripts/*.sh`, including `shellcheck source=` comments) get updated to `../../arcanum/_lib/...`.
- Both install methods end up with the same relative layout (skill folders + `arcanum/` at the root of the tree), so `_lib` resolution works identically whether the user cloned or curl-installed — no compatibility shim needed.

**Release pipeline (CircleCI)**

- New `.circleci/config.yml` — no CI config exists in the repo today. One job, triggered only on tag pushes matching the existing semver convention (e.g. `0.9.10`, no `v` prefix).
- The job builds the trimmed zip (skill folders + `arcanum/` + `arcanum.version`, excluding `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, `.github/`, `ISSUE_TEMPLATE.md`, `.gitignore`, `.git/`) and publishes it as a GitHub Release asset for that tag — publicly downloadable over plain HTTPS, no auth needed for the install script to fetch it.
- Requires a GitHub token configured as a CircleCI env var/context to create the release and attach the asset.
- Also lays groundwork for a future shell-script test framework for this repo (see [docs/agents/todo.md](../../docs/agents/todo.md)) — this is the first CI infra the repo gets, even though a test-running job isn't part of this issue.

**Security**

- No `sudo` anywhere — the installer only ever writes to user-writable paths, scoping blast radius to the invoking user's account.
- The blindly-executed bootstrap script is deliberately minimal; the heavier logic lives in the versioned, inspectable installer inside the zip.
- Integrity of the downloaded zip relies on HTTPS + GitHub's own guarantees; no separate checksum/signature step for now — considered and deferred as disproportionate for the project's current scale, revisitable later.

**Backward compatibility**

- Confirmed compatible for existing `git clone` users: skill folders don't move, `_lib`'s new location is transparent (internal-only reference, not a public contract, moved together with its consumers), and everything else added is purely additive.

**Documentation**

- `README.md` gets the new `curl | bash` one-liner documented as an install option, alongside the existing `git clone` instructions.

**Explicitly deferred to future work**

- Testing strategy for the install script and CI pipeline — left for the planning stage.
- An update/upgrade flow for re-running the installer against an existing install.

## Benefits

- Removes the git-clone requirement to try or use arcanum, lowering the barrier to entry.
- Keeps dev-only files out of what end users install, via a purpose-built trimmed release zip.
- Minimal, auditable bootstrap script keeps the `curl | bash` trust surface small.
- Establishes the repo's first CI pipeline (CircleCI), laying groundwork for a future automated test framework.
- Fully backward compatible — existing `git clone` users are unaffected.
