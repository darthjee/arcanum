# Plan: Split autoFixAllQueueParity_spec.js into per-subcommand files

Issue: [289-split-autofixallqueueparity-spec-js-into-per-subcommand-files.md](../issues/289-split-autofixallqueueparity-spec-js-into-per-subcommand-files.md)

## Overview

Applies #288's per-subcommand spec-splitting convention to `core/spec/bin/autoFixAllQueueParity_spec.js` (479 lines, 7 subcommands, 14 tests), and consolidates the `git remote set-url origin`-rewriting helper duplicated across 8 parity spec files into one shared `seedOriginUrl` in `core/spec/support/utils/runCommand.js`.

See [node.md](node.md) for the full plan.
