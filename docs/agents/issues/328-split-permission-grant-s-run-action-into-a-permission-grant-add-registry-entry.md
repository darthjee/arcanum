# Issue: Split permission-grant's run(action, …) into a permission-grant-add registry entry

## Description

`permission-grant` is the native CLI command registry's one internal-dispatch
outlier. Post-#321 its entry is:

```js
'permission-grant': { module: 'commands/PermissionGrant.js', method: 'run', context: 'claude' },
```

`PermissionGrant#run(action, file, pattern)` checks `action === 'add'` and throws
a usage message for anything else. Every other multi-verb command in
`core/lib/core/commands.js` uses one registry entry per verb, each mapped straight
to a same-named method:

- `auto-fix-all-config-{get,is-enabled,set,toggle}` -> `AutoFixAllConfig`
- `auto-fix-all-queue-{empty,list,next,pop,push,save,wait-next}` -> `AutoFixAllQueue`
- `auto-fix-all-github-{add-tag,cleanup-branch,...}` -> `AutoFixAllGithub`
- `arcanum-update-run-update-{check,apply}` -> `ArcanumUpdateRunUpdate`
- `github-issue-{create,info}` -> `GithubIssue`

`permission-grant`'s shape is a faithful 1:1 port (#236) of the shell
`arcanum/_lib/permission_grant.sh`'s `case "${1:-}" in add)` structure, usage
message included. `add` is currently its only verb. Surfaced during the #321
discussion (`permission-grant` -> `ClaudeContext` migration) and kept out of that
issue's scope as an independent cleanup.

## Problem

`PermissionGrant#run` re-implements verb dispatch inside the command instead of
letting the registry do it. This:

- diverges from the one-entry-per-verb convention every other multi-verb command
  follows;
- carries a dead `action !== 'add'` branch and a `USAGE_MESSAGE` const that only
  exists to service it;
- leaves `permission-grant` as the last registry entry whose `method` is a
  generic `run` rather than the verb name.

## Expected Behavior

A dedicated `permission-grant-add` registry entry mapped to `method: 'add'`,
`context: 'claude'` (retained — #321 has landed, so `PermissionGrant` is
constructor-injected with `ClaudeContext`). `run` and `USAGE_MESSAGE` are gone;
`add(file, pattern)` — which already exists as the real implementation — becomes
the dispatched method directly. The `permission_grant.sh <anchor> add <file>
<pattern>` human/agent CLI surface is unchanged; the engine command it dispatches
to becomes `permission-grant-add`.

## Solution

Native side:

- `core/lib/core/commands.js`: replace the `'permission-grant'` entry with
  `'permission-grant-add': { module: 'commands/PermissionGrant.js', method: 'add', context: 'claude' }`.
  Update the `context` typedef JSDoc, which currently names `permission-grant` as
  the sole `'claude'` example.
- `core/lib/commands/PermissionGrant.js`: delete `run` and `USAGE_MESSAGE`; keep
  `add(file, pattern)` as-is. Update class / entry-point JSDoc that names the old
  command.

Leading `add` token — mirrors the `github-issue-{info,create}` precedent:

- Stop forwarding the literal `add` token through the passthrough args on both
  paths. The verb is encoded in the engine command name (`permission-grant-add`),
  exactly as `github-issue-info` / `github-issue-create` encode theirs.
- `arcanum/_lib/permission_grant.sh`: after the `case add)` match, call
  `engine_dispatch "$anchor" permission-grant-add ".../permission_grant_shell.sh" -- "$anchor" "$@"`
  (no `add`).
- `arcanum/_lib/permission_grant_shell.sh`: its CLI dispatcher block — currently
  `case "${1:-}" in add)` — collapses to treating its args as `<anchor> <file>
  <pattern>` directly (there is only one verb), matching how
  `github_issue_info_shell.sh` is already verb-specific. The sourced
  `permission_grant_add` function used by `arcanum/migrations/repos/*/*.sh` is
  untouched.
- This drops the `action !== 'add'` usage-message parity case entirely (native no
  longer has an `action` guard to exercise).

Tracking / generated files:

- `arcanum/_lib/migration-status.json`: rename key `permission-grant` ->
  `permission-grant-add`.
- `docs/agents/architecture/entrypoint-migration-status.md`: regenerate via
  `scripts/generate_entrypoint_migration_status.sh`. The generator resolves each
  row's Issue number from the first commit whose `migration-status.json` snapshot
  contains the key, so after the rename that row attributes to #328 rather than
  #230 (the original native migration). This flip is accepted — no generator
  change; the #230 provenance stays discoverable through git history and the
  #236/#230 issue chain.

## Benefits

- `permission-grant` stops being the registry's lone internal-dispatch outlier —
  every multi-verb command maps one entry per verb to a same-named method.
- Removes dead code: `run`, `USAGE_MESSAGE`, the `action` guard, and the
  unrecognized-action parity case.
- The shell fallback for `add` becomes verb-specific, matching the
  `github-issue-{info,create}` shim structure.

## Coordination with #321

Resolved: #321 landed first (commit `0d73de5`). This issue takes the "rename the
`context: 'claude'` entry" path from the original plan — the key becomes
`permission-grant-add`, `method` becomes `add`, `context: 'claude'` is retained.
No outstanding dependency.

## Out of scope

- The `ClaudeContext` migration itself (#321, done).
- Any behaviour change to `add` / dedupe / atomic-write / silent-degrade.
- The pure-shell in-process `permission_grant_add` function used by
  `arcanum/migrations/repos/*/*.sh`.

## Testing strategy

- `core/spec/lib/core/commands_spec.js`: update the `permission-grant` context
  assertion to `permission-grant-add`.
- `core/spec/lib/core/dispatcher_spec.js`: update the `context: 'claude'` describe
  (command name; `commandArgs()` now `[<file>, <pattern>]` without the `add`
  token), the `claudeContext` getter test, and the never-validates-`'claude'`
  test.
- `core/spec/lib/commands/PermissionGrant` specs: drop the `action !== 'add'`
  usage-message case; `add` behaviour coverage otherwise unchanged.
- `core/spec/bin/permissionGrantParity_spec.js`: update the invoked command name;
  drop the unrecognized-action (`remove`) parity case.
- Shell-mode path still exercised: `engine.mode=shell` falls back to
  `permission_grant_shell.sh <anchor> <file> <pattern>`.
- Full `core/spec` suite green.
