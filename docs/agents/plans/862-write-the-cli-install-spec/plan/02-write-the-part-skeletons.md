# Write the four part skeletons

Create each part under `docs/agents/specs/cli-install/` with **Purpose** / **Decisions** / **Alternatives considered** / **Open points**. Each part holds only #861's decisions that belong to it, plus a link back to the index. Shared rules stay in the index and are referenced, not repeated.

- `install.md`:
  - Decisions: the installer (`arcanum/install/installer.sh`, through `bootstrap.sh`) runs the shared client step; the install exits `0` whatever the client outcome.
  - Alternatives: updating an existing arcanum install instead of refusing.
  - Open points: where the step runs relative to the target-directory prompt; detecting an unpublished version (`npm view`).
- `update.md`:
  - Decisions: the zip `updater.sh` runs the step; `bootstrap.sh`'s git path calls it from the checked-out tree; `/arcanum-update` opts in to `FALLBACK=chat`; the global skippable migration.
  - Alternatives: a one-update lag for git installs; a repo-scoped or nudge-only migration.
  - Open points: the script name and location; how the skill resumes; the `next/NNN` id.
- `already-installed.md`:
  - Decisions: an older client is updated in place; the same version is a no-op with a note; a newer client is left as is, with a downgrade note.
  - Alternatives: auto-downgrade.
  - Open points: version detection (`npm ls -g --json` or `arcanum --version`); a foreign `arcanum` binary on `PATH`.
- `self-update.md`:
  - Decisions: `arcanum self-update` runs `npm i -g arcanum-cli@latest`, with no arguments.
  - Alternatives: the names `update` or `upgrade`; shipping a version argument, `--check`, or new skew hints now.
  - Open points: the `--json` shape and exit codes; mapping npm failures onto `cli/lib/exitCodes.js`.

## Files to Change

- `docs/agents/specs/cli-install/install.md`: new.
- `docs/agents/specs/cli-install/update.md`: new.
- `docs/agents/specs/cli-install/already-installed.md`: new.
- `docs/agents/specs/cli-install/self-update.md`: new.
