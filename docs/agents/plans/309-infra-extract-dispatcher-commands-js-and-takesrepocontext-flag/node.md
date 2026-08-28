# node Plan: Infra: extract Dispatcher, commands.js and takesRepoContext flag

Main plan: [plan.md](plan.md)

## Overview

`core/bin/arcanum`'s `dispatch()` currently owns three concerns: the `COMMANDS`
registry, `InvocationLog` recording, and module resolution/invocation. Commands
are built with `new ModuleClass()` and receive `repoPath` as a leading positional
CLI argument.

This plan extracts those concerns without migrating any command:

- `core/lib/core/commands.js` — the `COMMANDS` object, verbatim, plus an optional
  `takesRepoContext` field in the entry shape (no real entry sets it) and one
  test-only fixture entry that does.
- `core/lib/commands/DispatchFixtureRepoContext.js` — a tiny fixture command that
  takes `repoContext` at construction and echoes what it received, so the flag-on
  path is exercised end-to-end through the real registry.
- `core/lib/core/dispatcher.js` — a `Dispatcher(command, args)` class owning
  registry lookup, the unknown-command error, `InvocationLog` recording, lazy
  memoized `RepoContext` from `args[0]`, the `commandArgs()` arg-stripping branch,
  and module resolution/invocation.
- `core/bin/arcanum` — reduced to argv parse → `new Dispatcher(...).dispatch()` →
  print string result → error/exit-code contract.
- `core/spec/lib/core/dispatcher_spec.js` (+ a small commands spec and the
  fixture-module spec) — new coverage; every existing `bin/arcanum` and parity
  spec stays green untouched.

## Context

Relevant current state:

- `core/bin/arcanum` (lines 39–95) holds the inline `COMMANDS` map;
  `dispatch()` (lines 103–128) does registry lookup, the
  `throw new Error("unknown command '<command>'")`, `InvocationLog#record`
  (gated on `entry.log !== false`), `pathToFileURL(path.join(libDir, entry.module))`
  resolution, `new ModuleClass()[entry.method](...args)`, a thenable-await, and a
  `typeof output === 'string'` stdout write. The bottom `.catch` maps
  `DispatchFailure` → stdout + `exitCode`, anything else → `arcanum: <message>`
  on stderr + exit 1.
- `libDir` and `configChainPath` are module-level consts derived from
  `import.meta.url` in `core/bin/arcanum` (lines 20–31). Both move to
  `core/lib/core/dispatcher.js` and must be re-anchored: from
  `core/lib/core/`, `libDir` is `..` and `config_chain.sh` is
  `../../../arcanum/_lib/config_chain.sh`.
- `RepoContext` (`core/lib/context/RepoContext.js`) is constructed
  `new RepoContext({ repoPath })` in production — the pattern ~6 commands already
  use directly. `RepoContextFactory` is only for callers that also need bundled
  git/GitHub clients, which `Dispatcher` does not — it just hands the bare context
  to the command constructor.
- `InvocationLog` (`core/lib/utils/logging/InvocationLog.js`) —
  `new InvocationLog({ configChainPath }).record(command)`; every failure is
  swallowed; `record` reads `ARCANUM_REPO_PATH` from the environment itself.
- `DispatchFixture` (`core/lib/commands/DispatchFixture.js`) — no constructor;
  `run()` returns `'dispatch-fixture: ok\n'` byte-identical to the shell fixture,
  `crash()` throws. Its shell-parity contract is why the flag-on fixture is a
  **separate** module, not a new method here.
- Tests: jasmine (`spec/support/jasmine.json` globs `lib/**/*_spec.js` and
  `bin/**/*_spec.js`), run via `yarn test` (`c8 jasmine`) from `core/`. eslint
  (`yarn lint`, `eslint .`) enforces 2-space indent, single quotes, semicolons,
  `eqeqeq`, and JSDoc on every public class/method/function.
- `core/spec/bin/arcanum_spec.js` already covers, end to end: `dispatch-fixture`
  success, `dispatch-fixture-crash` (exit non-zero, empty stdout), unknown command
  (stderr names it, empty stdout, non-zero), and five invocation-logging cases
  including "a crashing command is still logged first". These are the real
  guarantee for the logging/crash behavior after it moves into `Dispatcher`.

## Steps

- [01 — Extract the COMMANDS registry into commands.js](node/01-extract-commands-registry.md)
- [02 — Add the repo-context fixture command](node/02-add-repo-context-fixture.md)
- [03 — Add the Dispatcher class](node/03-add-dispatcher-class.md)
- [04 — Reduce core/bin/arcanum to a thin entrypoint](node/04-thin-entrypoint.md)
- [05 — Add Dispatcher / commands specs and verify the suite](node/05-dispatcher-specs.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- **`dispatch()` async unwrap**: `Dispatcher.dispatch()` is `async` and does
  `return instance[method](...args)` — returning a promise from an async method
  awaits it, so a plain value always reaches the entrypoint. The explicit
  `output.then` check in today's `core/bin/arcanum` is therefore not needed inside
  `Dispatcher`; the entrypoint only needs `if (typeof output === 'string')`.
- **Unknown command**: `Dispatcher.dispatch()` throws
  `new Error("unknown command '<command>'")` when `this.entry` is undefined; the
  entrypoint's existing non-`DispatchFailure` branch formats it as
  `arcanum: unknown command '<command>'` on stderr + exit 1, satisfying the
  existing spec unchanged. (Alternative: keep an explicit guard in the entrypoint —
  either is acceptable, but keeping it in `Dispatcher` keeps the entrypoint free of
  any `COMMANDS` import.)
- **`InvocationLog` injectability**: `new InvocationLog({ configChainPath })` is
  currently built inline. Add an optional constructor seam on `Dispatcher`
  (e.g. `constructor(command, args, { invocationLog } = {})`, defaulting to
  `new InvocationLog({ configChainPath })`) so the "record is awaited before the
  module is imported" ordering can be unit-tested. Behavior with no injection is
  unchanged.
- **Filename casing**: every other non-command file under `core/lib/` is
  PascalCase (`RepoContext.js`). This plan follows #308/#309 as written —
  `core/lib/core/dispatcher.js` and `commands.js` lowercase (`commands.js` is a
  data module; `dispatcher.js` matches it for the pair). Flag for reviewer if the
  repo wants `Dispatcher.js` instead; the export name stays `Dispatcher`.
- **`arcanum/_lib/migration-status.json`**: the new `dispatch-fixture-repo-context`
  entry is invoked only directly against `core/bin/arcanum` in specs, never
  through `engine_dispatch.sh`, so it needs **no** `migration-status.json` entry
  and no scripter/infra change. This is a deliberate non-change.
- Keep `dispatch-fixture` / `dispatch-fixture-crash` entries and their
  `log` semantics exactly as they are.
