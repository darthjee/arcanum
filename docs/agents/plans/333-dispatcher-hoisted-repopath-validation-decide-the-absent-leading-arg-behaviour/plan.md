# Plan: Dispatcher-hoisted repoPath validation: decide the absent-leading-arg behaviour

Issue: [333-dispatcher-hoisted-repopath-validation-decide-the-absent-leading-arg-behaviour.md](../../issues/333-dispatcher-hoisted-repopath-validation-decide-the-absent-leading-arg-behaviour.md)

## Overview

Resolve the provisional behaviour #331 shipped: drop the `&& this.args[0]`
clause from `Dispatcher.dispatch()`'s `context: 'repo'` guard so
`RepoContext#validate()` always runs (subject only to `validateRepoPath`),
making a bare, positional-less `core/bin/arcanum <cmd>` invocation throw a
uniform `Error: repo_path is required` instead of a per-command `Usage:`
string or a raw `TypeError`. All work is in `core/` plus one architecture-doc
note, owned by the `node` agent.

See [node.md](node.md) for the full plan.
