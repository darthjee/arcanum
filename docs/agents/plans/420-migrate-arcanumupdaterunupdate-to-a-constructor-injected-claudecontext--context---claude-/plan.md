# Plan: Migrate ArcanumUpdateRunUpdate to a constructor-injected ClaudeContext (context: 'claude')

Issue: [420-migrate-arcanumupdaterunupdate-to-a-constructor-injected-claudecontext--context---claude-.md](../issues/420-migrate-arcanumupdaterunupdate-to-a-constructor-injected-claudecontext--context---claude-.md)

## Overview

Give `arcanum-update-run-update-check` / `-apply` `context: 'claude'`, so `Dispatcher`
builds and injects a `ClaudeContext` instead of `ArcanumUpdateRunUpdate` receiving the
arcanum install's own path as a per-method `repoPath` argument — mirroring the
`permission-grant-add` / `PermissionGrant` precedent, now that #419 has landed the
`ClaudeContext` API (`bootstrapPath()`, `arcanumJsonPath()`, `gitDirPath()`,
`installRoot()`, `validateInstall()`) this depends on.

See [node.md](node.md) for the full plan.
