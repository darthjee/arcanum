# Plan: Centralize repoPath validation into Dispatcher/RepoContext

Issue: [331-centralize-repopath-validation-into-dispatcher-repocontext.md](../../issues/331-centralize-repopath-validation-into-dispatcher-repocontext.md)

## Overview

Move `RepoPath#validate` out of every `context: 'repo'` command's `run()` and into
a single lazy `RepoContext#validate()` that `Dispatcher` calls once — after
`InvocationLog#record`, before the command module is imported. Drop the
per-command `repoPathValidator` / `repoPath` validation dependency from the 13
modules that carry it, bring the 5 currently-under-validating `context: 'repo'`
surfaces under the same guard (matching their `*_shell.sh` counterparts), and
exempt `github-issue-info` via a per-entry registry flag. Error strings are
unchanged; every migrated entrypoint's shell-parity spec is re-run.

The work is entirely within `core/` — it is the [node](node.md) agent's.

See [node.md](node.md) for the full plan.
