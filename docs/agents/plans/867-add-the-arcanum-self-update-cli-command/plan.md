# Plan: Add the arcanum self-update CLI command

Issue: [867-add-the-arcanum-self-update-cli-command.md](../../issues/867-add-the-arcanum-self-update-cli-command.md)

## Overview
Implement `arcanum self-update [--json]` in `cli/` as specified in [self-update.md](../../specs/cli-install/self-update.md), plus the implementation decisions recorded in the issue: semver-precedence `compareVersions`, a `cli/lib/npm.js` runner that classifies npm failures, exit codes `8` (`npm`) and `130` (`interrupted`), a bundle smoke spec, and the doc updates. All work is in the `client` agent's scope.

See [client.md](client.md) for the full plan.
