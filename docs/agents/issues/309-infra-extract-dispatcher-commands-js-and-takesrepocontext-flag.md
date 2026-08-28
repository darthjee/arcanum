## Scenario and problem

`core/bin/arcanum`'s `dispatch()` function owns three concerns at once: the
`COMMANDS` registry, `InvocationLog` recording, and module resolution/invocation.
Commands are constructed with `new ModuleClass()` and then receive `repoPath` as a
leading positional CLI argument that each command re-resolves per call. This
couples every command to argv parsing and blocks moving repo context to
construction time.

This sub-issue is the enabling infra change for #308. It introduces the
`Dispatcher` class, the extracted `commands.js` registry, and the
`takesRepoContext` flag mechanism — **without migrating any real command**. The
flag defaults off, so behavior is unchanged and all existing specs stay green.

After the split, `Dispatcher` owns registry lookup, `InvocationLog` recording, and
module resolution/invocation; `core/bin/arcanum` stays a thin entrypoint that only
parses argv, prints a string result, and enforces the output/exit-code contract.

## Ownership

Despite the `Infra:` title prefix inherited from #308, all work here is Node.js
source under `core/lib/`, `core/bin/`, and `core/spec/` — this is the **`node`**
agent's scope, not `infra`. `core/lib/core/` is a new subfolder, not a new
top-level repo folder, and falls under the `node` agent's existing `core/lib/`
ownership.

## Changes

### `core/lib/core/commands.js` (new)

- Extract the `COMMANDS` object out of `core/bin/arcanum` verbatim.
- Add an optional `takesRepoContext` boolean to each entry's shape. **No real
  command entry sets it** — it is the single source of truth driving both
  `commandInstance()` and `commandArgs()` in `Dispatcher`, so those two decisions
  can never diverge.
- Add one **test-only fixture entry** that sets `takesRepoContext: true`, so the
  flag-on path can be exercised end-to-end through the real registry — parallel to
  how `dispatch-fixture-crash` exists purely to prove `InvocationLog`'s
  crash-logging behavior:

```js
export const COMMANDS = {
  'spawn-issue': { module: 'commands/SpawnIssue.js', method: 'run' },
  'dispatch-fixture': { module: 'commands/DispatchFixture.js', method: 'run', log: false },
  // ...remaining real entries unchanged, none setting takesRepoContext

  // test-only fixture — flag-on proof, removed with the flag in sub-issue 6
  'dispatch-fixture-repo-context': {
    module: 'commands/DispatchFixtureRepoContext.js',
    method: 'run',
    takesRepoContext: true,
    log: false,
  },
};
```

Planning decides whether the fixture is a dedicated `DispatchFixtureRepoContext`
module or a new method/constructor on the existing `DispatchFixture` — a dedicated
module is preferred so `DispatchFixture`'s byte-identical shell-parity contract
stays untouched. The fixture's method must return something that proves it
received a `RepoContext` (e.g. echoing `repoContext.repoPath`) and the
argv-stripped args.

### `core/lib/core/dispatcher.js` (new)

`Dispatcher` is constructed with `command` and `args` and owns the full dispatch
path, including `InvocationLog` recording and the unknown-command error:

```js
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMANDS } from './commands.js';
import RepoContext from '../context/RepoContext.js';
import InvocationLog from '../utils/logging/InvocationLog.js';

const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Three levels up from core/lib/core, reaching arcanum/_lib/config_chain.sh —
// the same target core/bin/arcanum resolves today, re-anchored to this module.
const configChainPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'arcanum', '_lib', 'config_chain.sh'
);

export default class Dispatcher {
  constructor(command, args) {
    this.command = command;
    this.args = args;
    this.entry = COMMANDS[command];
  }

  async dispatch() {
    if (!this.entry) {
      throw new Error(`unknown command '${this.command}'`);
    }

    if (this.entry.log !== false) {
      await new InvocationLog({ configChainPath }).record(this.command);
    }

    const instance = await this.commandInstance();
    // async unwrap: returning a promise from this async method awaits it,
    // so a plain value reaches the entrypoint either way.
    return instance[this.entryMethod()](...this.commandArgs());
  }

  async commandInstance() {
    const { default: ModuleClass } = await import(this.modulePath());
    if (!this.entry.takesRepoContext) return new ModuleClass();
    return new ModuleClass(this.repoContext);
  }

  get repoContext() {
    if (!this._repoContext) {
      this._repoContext = new RepoContext({ repoPath: this.args[0] });
    }
    return this._repoContext;
  }

  commandArgs() {
    return this.entry.takesRepoContext ? this.args.slice(1) : this.args;
  }

  entryMethod() {
    return this.entry.method;
  }

  modulePath() {
    return pathToFileURL(path.join(libDir, this.entry.module)).href;
  }
}
```

- `InvocationLog` recording moves **into `Dispatcher`**, awaited before the
  command module is imported — preserving the crash-logging guarantee proven by
  `dispatch-fixture-crash` (now at the `Dispatcher` level). `configChainPath` is
  re-anchored to `dispatcher.js`'s own module URL.
- The unknown-command error is thrown by `Dispatcher`; `core/bin/arcanum`'s
  existing `catch` formats any non-`DispatchFailure` error as
  `arcanum: <message>` on stderr + exit 1, so `arcanum: unknown command '<name>'`
  keeps the existing spec's contract (stderr names the command, stdout empty,
  non-zero exit).
- `repoContext` is built lazily and memoized — only when a command entry sets the
  flag (today, only the fixture entry).
- `commandArgs()` strips the leading `repoPath` (`args.slice(1)`) only when the
  flag is set; otherwise args pass through unchanged.
- `dispatch()` returns the awaited command result as a plain value. It does **not**
  write to stdout — that stays in the entrypoint.
- `modulePath()` keeps resolving `entry.module` under `core/lib/` exactly as the
  current `pathToFileURL(path.join(libDir, entry.module)).href` does, re-anchored
  to `dispatcher.js`.

### `core/bin/arcanum`

- Delete the inline `COMMANDS`, `dispatch()`, and the `libDir` / `configChainPath`
  consts (moved into `Dispatcher`).
- Keep the entrypoint thin: parse
  `const [command, ...args] = process.argv.slice(2)`, then
  `new Dispatcher(command, args).dispatch()`, print the result if it is a string,
  and enforce the error/exit-code contract:

```js
import Dispatcher from '../lib/core/dispatcher.js';
import DispatchFailure from '../lib/utils/errors/DispatchFailure.js';

const [command, ...args] = process.argv.slice(2);

new Dispatcher(command, args)
  .dispatch()
  .then((output) => {
    if (typeof output === 'string') {
      process.stdout.write(output);
    }
  })
  .catch((error) => {
    if (error instanceof DispatchFailure) {
      process.stdout.write(error.stdout);
      process.exitCode = error.exitCode ?? 1;
      return;
    }

    process.stderr.write(`arcanum: ${error.message}\n`);
    process.exitCode = 1;
  });
```

- Preserve the output/exit-code contract exactly: `DispatchFailure` → stdout +
  exit 1 with no stderr; any other error (including unknown command) →
  `arcanum: <message>` on stderr + exit 1.

## Tests

- New `core/spec/lib/core/dispatcher_spec.js`:
  - **flag-off path**: builds `new ModuleClass()`, passes `args` through unchanged,
    returns the method's result; `repoContext` is never built.
  - **flag-on path** (via the `dispatch-fixture-repo-context` registry entry):
    builds `new ModuleClass(repoContext)` with a `RepoContext` whose `repoPath` is
    `args[0]`, and strips the leading arg from `commandArgs()`.
  - `repoContext` is built lazily and memoized (same instance across calls).
  - **`InvocationLog` recording**: `record(command)` is awaited before the command
    module is imported; skipped when `entry.log === false`; a crashing command is
    still logged first (the `dispatch-fixture-crash` guarantee, now at the
    `Dispatcher` level).
  - unknown command throws `Error` naming the command.
- New small unit spec for the `DispatchFixtureRepoContext` fixture module (or the
  added `DispatchFixture` method, per the planning decision).
- Existing `core/spec/bin/arcanum_spec.js` and all `core/spec/bin/*Parity_spec.js`
  keep passing unchanged — `dispatch-fixture`, `dispatch-fixture-crash`, unknown
  command, and every invocation-logging case.

## Out of scope

- No real command's `COMMANDS` entry or constructor changes here — that is
  sub-issues 2–5 of #308.
- The `takesRepoContext` flag and the `commandArgs()` branch are removed in
  sub-issue 6, along with the `dispatch-fixture-repo-context` fixture entry and its
  module.
