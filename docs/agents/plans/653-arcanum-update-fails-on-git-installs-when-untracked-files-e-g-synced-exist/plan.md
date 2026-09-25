# Plan: arcanum-update fails on git installs when untracked files (e.g. synced/) exist

Issue: [653-arcanum-update-fails-on-git-installs-when-untracked-files-e-g-synced-exist.md](../../issues/653-arcanum-update-fails-on-git-installs-when-untracked-files-e-g-synced-exist.md)

## Overview
`arcanum/update/bootstrap.sh`'s git-clone path treats untracked files as uncommitted changes, so the host-created `synced/` folder blocks every update. The scripter narrows the dirty check to tracked changes, ignores `synced/` in the root `.gitignore`, and updates the architecture doc. The node agent adds a Jasmine regression spec that runs the real `bootstrap.sh` against a temporary git-clone install.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

`bootstrap.sh`'s git-clone behavior, which the spec asserts against:

- **Install detection:** `TARGET` is two directories above the script's real on-disk location. It must contain `.git` and no `arcanum.json` to take the git path. The spec therefore runs a copy of `bootstrap.sh` at `<clone>/arcanum/update/bootstrap.sh`, committed into the fixture repo.
- **Env vars:** `ARCANUM_VERSION=<tag>` skips the GitHub API lookup (no network). `ARCANUM_ASSUME_YES=1` skips the `/dev/tty` prompt. Set `ARCANUM_REPO` to any value (e.g. `test/arcanum`) so the origin URL parse doesn't matter.
- **Dirty check (after the change):** `git -C "$TARGET" status --porcelain --untracked-files=no`. If it's non-empty, the script prints `Error: <TARGET> has uncommitted changes.` to stderr and exits 1, and HEAD doesn't change.
- **Success:** runs `git fetch --tags --prune` then `git checkout <VERSION>`, prints `arcanum updated to <VERSION> at <TARGET>` to stderr, exits 0, and leaves HEAD detached at the tag.
