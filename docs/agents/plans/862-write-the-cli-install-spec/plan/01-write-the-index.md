# Write the index

Create `docs/agents/specs/cli-install.md` in `shell-engine-removal.md`'s shape, restating #861 in full so it reads without GitHub:

- **Status:** `Proposed`. Nothing is implemented yet.
- **Origin:** `Origin: epic #861; this spec supersedes the epic body.`
- **Goal:** installing or updating arcanum also installs or updates `arcanum-cli`, and the CLI can update itself.
- **Scope:** in scope and out of scope, copied from #861 (out: changing the installer for an existing arcanum install, installing Node or npm, uninstall).
- **Shared rules:**
  - a separate `[Y/n]` prompt after the arcanum confirmation, read from `/dev/tty`, defaulting to yes;
  - `ARCANUM_SKIP_CLI=1` skips the step; `ARCANUM_ASSUME_YES` does not answer the client prompt;
  - the opt-in `FALLBACK=chat` exit `4`, only when the caller sets a flag such as `ARCANUM_CLI_PROMPT=chat`;
  - with no TTY and no opt-in, skip with a warning;
  - any client failure (no Node or npm, Node below 22.13.0, npm EACCES or network error) warns with the manual command and never fails arcanum; no `sudo` retry.
- **Version pinning:** `arcanum-cli@<arcanum version>`. If that version is not published, warn and skip. `self-update` uses `@latest`.
- **Backward compatibility:**
  - zip installs run the new `updater.sh` on the first update;
  - `git clone` installs call the client step from the checked-out tree, with a one-time manual pointer for the first update;
  - an old `/arcanum-update` never sees exit `4`.
- **Migration:** a global, skippable `next/NNN` that installs or updates the client. It reverses the "no migration installs it" rule in `install-and-release.md` (changed in #872).
- **Parts:** links to the four parts, one line each.
- **Alternatives considered:** the index-level list from the issue.
- **Open points:** the exact env var names, and the prompt and warning wording.
- **See also:** `install-and-release.md`, `arcanum-cli.md`, `per-repo-migrations.md`, `docs/guides/arcanum-cli.md`.

## Files to Change

- `docs/agents/specs/cli-install.md`: new.
