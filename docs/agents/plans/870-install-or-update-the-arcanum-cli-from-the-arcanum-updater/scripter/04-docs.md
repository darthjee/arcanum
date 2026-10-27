# Docs

Bring the spec in line with the implementation. The spec is the source of truth, so fix it in this PR if the implementation had to diverge.

- `docs/agents/specs/cli-install.md`, `## Status`: the updater caller (#870) now exists, next to the installer (#869) and `arcanum self-update` (#867). Only `/arcanum-update` (#871) and the migration (#872) are still pending.
- `docs/agents/specs/cli-install/update.md`, `## Testing strategy`: replace "bats tests for `updater.sh` and the `bootstrap.sh` git path" with the two standalone scripts:
  - `arcanum/update/test_updater.sh`;
  - `arcanum/update/test_update_bootstrap.sh`.

  Both are standalone, like `arcanum/install/test_installer.sh`, and running them in CI is #882. Keep the listed assertions, and add that a usage-error exit `1` from the client step is ignored.
- `docs/agents/specs/cli-install/update.md`, `### git clone path`: add one line on the placement rule. The call stays inside the git `if` block of `bootstrap.sh`, because `git checkout` rewrites the running script.

Leave the README, the user guide (#873) and the architecture docs (#874) alone.

## Files to Change

- `docs/agents/specs/cli-install.md`: the Status line.
- `docs/agents/specs/cli-install/update.md`: the Testing strategy and the git-path placement note.
