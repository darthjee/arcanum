# CLI Install: Install

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue) and version pinning live in the index and apply here unchanged.

## Purpose

Make the `curl | bash` installer (`arcanum/install/`) install `arcanum-cli@<version>` as part of installing arcanum.

## Decisions

- The installer (`arcanum/install/installer.sh`, run through `arcanum/install/bootstrap.sh`) runs the shared client step after the arcanum confirmation.
- The target is `arcanum-cli@<the arcanum version being installed>`, per [Version pinning](../cli-install.md#version-pinning).
- The install exits `0` whatever the client outcome: installed, skipped, or failed with a warning.
- When the client is already installed, the step follows [already-installed.md](already-installed.md).

## Alternatives considered

- **Updating an existing arcanum install** instead of refusing. Rejected and out of scope: the installer keeps refusing when the target directory already has an arcanum install, and points to `update`.

## Open points

- Where the client step runs relative to the target-directory prompt.
- How a version that is not published on npm is detected (for example `npm view arcanum-cli@<version> version`).
