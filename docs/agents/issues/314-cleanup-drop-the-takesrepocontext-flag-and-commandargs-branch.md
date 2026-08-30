# Issue: Cleanup: drop the takesRepoContext flag and commandArgs() branch

## Description

Final cleanup sub-issue (6 of 6) for #308. Sub-issues 1-5 (#309, #310, #311, #312, #313) are merged and every context-bound command now receives a constructor-injected `RepoContext`. The `takesRepoContext` flag on `COMMANDS` entries and its paired branches in `Dispatcher.commandInstance()` and `Dispatcher.commandArgs()` were migration scaffolding. Remove them so `repoContext` construction and the leading-`repoPath` strip are unconditional for every command except a small exempt set.

**On hold.** Discussion surfaced that making `Dispatcher.commandArgs()`'s `args.slice(1)` unconditional is not free: `permission-grant` carries no `repoPath` argument at all, and `AutoFixAllConfig` / `AutoFixAllQueue` / `ArcanumUpdateRunUpdate` each take `repoPath` as a method argument and would need a real constructor migration. Each currently-exempt command is being reviewed in its own issue first; this cleanup resumes once those resolve and it is known which commands remain exempt.

**Blocked by:**
- #309, #310, #311, #312, #313 (all merged) — the per-family migrations.
- #321 — review: `permission-grant`.
- #322 — review: `AutoFixAllConfig`.
- #323 — review: `AutoFixAllQueue`.
- #324 — review: `ArcanumUpdateRunUpdate`.

(`DispatchFixture` / `dispatch-fixture`, `dispatch-fixture-crash` is not under review — pure dispatch-routing test scaffolding, no repo by construction.)

## Problem

- `takesRepoContext: true` is now set on roughly 25 of ~30 registry entries. The flag marks the common case, not the exception, so it is pure noise on every migrated entry.
- `Dispatcher` still carries a two-branch conditional in `commandInstance()` and `commandArgs()` that only exists because the migration was incremental.
- `DispatchFixtureRepoContext` (`core/lib/commands/DispatchFixtureRepoContext.js`, `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js`, registry entry `dispatch-fixture-repo-context`) exists solely to exercise the flag-on branch end to end; its own docstring says it is "Removed together with the flag in #308 sub-issue 6."
- The `Dispatcher` class-level and method-level JSDoc still describes the `takesRepoContext` flag-on/flag-off paths.

## Expected Behavior

- For every non-exempt command, `Dispatcher` unconditionally builds `new RepoContext({ repoPath: args[0] })`, passes it to the constructor, and forwards `args.slice(1)` to the method.
- The five exempt command families (`DispatchFixture`, `PermissionGrant`, `AutoFixAllConfig`, `AutoFixAllQueue`, `ArcanumUpdateRunUpdate`) still get `new ModuleClass()` with untouched args.
- `core/lib/core/commands.js` no longer contains `takesRepoContext: true` on any entry; only the exempt entries carry a marker, and a top-of-file comment records which commands are exempt and why.
- The `repoContext` getter stays lazy and memoized, so exempt commands never construct a `RepoContext`.
- Full `core/spec` suite green.

## Solution

### `core/lib/core/dispatcher.js`
- `commandInstance()` - drop the `this.entry.takesRepoContext ? ... : ...` ternary; return `new ModuleClass(this.repoContext)` for non-exempt commands and `new ModuleClass()` for exempt ones, keyed off the new exempt marker.
- `commandArgs()` - drop the ternary; return `this.args.slice(1)` for non-exempt commands and `this.args` for exempt ones.
- Update the class-level and `commandInstance()` / `repoContext` JSDoc to describe the exempt marker instead of `takesRepoContext`.

### `core/lib/core/commands.js`
- Delete `takesRepoContext: true` from every migrated entry (now the default).
- Mark only the exempt entries with the opposite marker (final name decided in planning - candidates: `noRepoContext: true`, `takesRepoContext: false`, or a dispatcher-side allowlist; pick the least noisy).
- Replace the `takesRepoContext` `@property` typedef doc with the exempt marker, and add a top-of-file comment listing the exempt commands and why each is exempt:
  - `DispatchFixture` (`dispatch-fixture`, `dispatch-fixture-crash`) - fixture proof commands, no repo.
  - `PermissionGrant` (`permission-grant`) - operates on a settings file, no repo context.
  - `AutoFixAllConfig` (`auto-fix-all-config-*`) - `repoPath` used only for config-file resolution.
  - `AutoFixAllQueue` (`auto-fix-all-queue-*`) - `repoPath` used only for queue-file resolution.
  - `ArcanumUpdateRunUpdate` (`arcanum-update-run-update-*`) - `repoPath` is the arcanum install's own self-resolved path, not a target repo.

### Remove the `dispatch-fixture-repo-context` scaffolding
- Delete the `dispatch-fixture-repo-context` registry entry from `commands.js` (and its explanatory comment).
- Delete `core/lib/commands/DispatchFixtureRepoContext.js` and `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js`.
- Re-point `dispatcher_spec.js`'s non-exempt-path tests at a real migrated command (e.g. `spawn-issue`), stubbing the dynamic `import()` so no real command module runs.

### Tests
- `core/spec/lib/core/dispatcher_spec.js` - reframe "flag-off path" as "exempt command" (still driven by `dispatch-fixture`) and "flag-on path" as "non-exempt command" (now driven by a real migrated command); assert non-exempt commands always get a `RepoContext` and `args.slice(1)`, and each exempt family gets `new ModuleClass()` with untouched args. The lazy/memoized `repoContext` getter tests move onto the non-exempt command name.
- `core/spec/lib/core/commands_spec.js` - drop `dispatch-fixture-repo-context` from the expected command list; invert the `takesRepoContext` assertion to check the exempt-marker set instead; keep the `log: false` and module/method coverage checks.

## Benefits

- Removes migration scaffolding once it has served its purpose - no dead conditional, no per-entry flag on the common path.
- One default dispatch path; the registry only annotates the rare exception.
- The exempt set is documented in one place with a rationale per command.
