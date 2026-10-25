# Issue: Write the CLI install spec

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Write the forward-looking spec for installing and updating the `arcanum-cli` client together with arcanum, following `docs/agents/specs.md` (an index file plus parts). Add its entry to the `docs/agents/specs.md` table. Docs only.

## Problem

The design was agreed in the body of epic #861, which is a discussion snapshot, not a maintained document. The follow-up sub-issues need one self-contained, authoritative place to read and refine it.

## Expected Behavior

- `docs/agents/specs/cli-install.md` (index) and four parts under `docs/agents/specs/cli-install/` exist, and together they restate every decision from #861.
- `docs/agents/specs.md` lists the index with status `Proposed`.
- From merge on, the spec (not #861) is the source of truth.

## Solution

### Files

- `docs/agents/specs/cli-install.md`: the index. It covers goals and non-goals (scope from #861), version pinning (`arcanum-cli@<arcanum version>`; a missing version is a warn-and-skip; `self-update` uses `@latest`), and the shared rules every part relies on:
  - the separate `[Y/n]` prompt after the arcanum confirmation;
  - `ARCANUM_SKIP_CLI=1` (and `ARCANUM_ASSUME_YES` not answering the client prompt);
  - the opt-in `FALLBACK=chat` exit `4`, enabled only by a caller flag such as `ARCANUM_CLI_PROMPT=chat`;
  - the no-TTY skip;
  - warn-and-continue on any client failure, with no `sudo` retry.

  It also covers backward compatibility, the migration, links to the parts, and open points.
- `docs/agents/specs/cli-install/install.md`: skeleton.
- `docs/agents/specs/cli-install/update.md`: skeleton.
- `docs/agents/specs/cli-install/already-installed.md`: skeleton.
- `docs/agents/specs/cli-install/self-update.md`: skeleton.
- `docs/agents/specs.md`: one row for the index only, status `Proposed`.

### Source of truth

- The index carries an **Origin** line: `Origin: epic #861; this spec supersedes the epic body.`
- Each part starts as a skeleton holding the decisions from #861 that belong to it. Its own "Enhance spec" sub-issue fleshes it out.

### Depth and shape

- This first pass writes down the decisions agreed in #861 and adds no new design. Every file, the index and each part, ends with an explicit **Open points** section. #863–#866 resolve those points and add edge cases, testing and security for each part.
- The index follows `docs/agents/specs/shell-engine-removal.md`'s shape: **Status** (`Proposed`) / **Origin** / **Goal** / **Scope** / **Shared rules** (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue) / **Version pinning** / **Backward compatibility** / **Migration** / **Parts** (links) / **Open points** / **See also**.
- Each part uses a lighter shape: **Purpose** / **Decisions** / **Alternatives considered** / **Open points**.

### Alternatives considered

Each file records the rejected options from #861 that belong to it:

- **Index:**
  - pinning to `@latest` instead of the arcanum version;
  - always installing the client with no opt-out;
  - opt-out by env var only, with no prompt;
  - `ARCANUM_ASSUME_YES` answering the client prompt;
  - failing the arcanum install or update when the client step fails;
  - accepting that an older `/arcanum-update` skill misreads exit `4`.
- **`install.md`:** changing the installer to update when an arcanum install already exists (kept out of scope).
- **`update.md`:**
  - accepting a one-update lag for `git clone` installs;
  - a repo-scoped migration, or a nudge-only migration, instead of the global, skippable install.
- **`already-installed.md`:** auto-downgrading a client that is newer than the target.
- **`self-update.md`:**
  - naming it `arcanum update` or `arcanum upgrade`;
  - shipping a version argument, `--check`, or new skew hints now.

### Open points to seed

These are the starting lists for #863–#866:

- **Index:** the exact env var names (`ARCANUM_SKIP_CLI`, the opt-in flag for `/arcanum-update`); the exact prompt and warning wording.
- **`install.md`:** where the client step runs relative to the target-directory prompt; how a version that is not on npm is detected (`npm view`).
- **`update.md`:** the name and location of the script that `bootstrap.sh` calls after `git checkout`; how `/arcanum-update` resumes after the chat answer; the migration's `next/NNN` id.
- **`already-installed.md`:** how the installed version is detected (`npm ls -g --json` or `arcanum --version`); how a foreign `arcanum` binary on `PATH` is handled.
- **`self-update.md`:** the `--json` output shape and exit codes; how npm failures map onto `cli/lib/exitCodes.js`.

### Spec name and location

The index is `docs/agents/specs/cli-install.md`, and the parts are under `docs/agents/specs/cli-install/`.

### Scope boundaries

- Docs only: no scripts, no `cli/` changes, no migration file, and no change to `install-and-release.md` yet (that is #872).
- No new root-level folder.

### Owner

`architect`.

### Dependencies

This is the first sub-issue of epic #861. #863–#875 depend on it.

### Testing strategy

Every relative link in the new files resolves, and the `docs/agents/specs.md` row points to the index.

### Migration needed?

No.

## Benefits

- One authoritative, self-contained design for epic #861, readable without GitHub.
- Recorded alternatives keep settled decisions from being reopened.
- Explicit open points give each "Enhance spec" sub-issue (#863–#866) a clear starting list.
