# Add the Dispatcher class

Create `core/lib/core/dispatcher.js` holding all dispatch logic currently inline
in `core/bin/arcanum`'s `dispatch()` function, plus the two module-level path
consts (`libDir`, `configChainPath`), re-anchored to the new file location.

## What to do

1. Module-level consts, derived from `import.meta.url` at `core/lib/core/`:
   - `libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')`
   - `configChainPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'arcanum', '_lib', 'config_chain.sh')`
   - Keep an explanatory comment for `configChainPath` (mirrors the current one in
     `core/bin/arcanum`).
2. `export default class Dispatcher` with:
   - `constructor(command, args, { invocationLog } = {})` — stores `command`,
     `args`, `this.entry = COMMANDS[command]`, and
     `this._invocationLog = invocationLog ?? new InvocationLog({ configChainPath })`
     (the injection seam is for step 05's ordering test; default behavior
     unchanged).
   - `async dispatch()`:
     1. `if (!this.entry) throw new Error(\`unknown command '${this.command}'\`);`
     2. `if (this.entry.log !== false) await this._invocationLog.record(this.command);`
        — awaited **before** the module import, preserving the crash-logging
        guarantee.
     3. `const instance = await this.commandInstance();`
     4. `return instance[this.entryMethod()](...this.commandArgs());` — async
        method, so a returned promise is awaited; entrypoint gets a plain value.
   - `async commandInstance()`:
     `const { default: ModuleClass } = await import(this.modulePath());`
     then `return this.entry.takesRepoContext ? new ModuleClass(this.repoContext) : new ModuleClass();`
   - `get repoContext()` — lazy + memoized:
     `this._repoContext ??= new RepoContext({ repoPath: this.args[0] });` then
     return it. Built only on the flag-on path.
   - `commandArgs()` —
     `return this.entry.takesRepoContext ? this.args.slice(1) : this.args;`
   - `entryMethod()` — `return this.entry.method;`
   - `modulePath()` —
     `return pathToFileURL(path.join(libDir, this.entry.module)).href;`
3. Imports: `path`, `fileURLToPath`/`pathToFileURL` from `node:url`,
   `{ COMMANDS }` from `./commands.js`, `RepoContext` from
   `../context/RepoContext.js`, `InvocationLog` from
   `../utils/logging/InvocationLog.js`.
4. Full JSDoc on the class and every method/getter (eslint `jsdoc/require-jsdoc`,
   `publicOnly: true`). 2-space indent, single quotes, semicolons, `eqeqeq`
   (`this.entry.log !== false`, not `!=`).

## Files to Change

- `core/lib/core/dispatcher.js` — **new**; `Dispatcher` class + `libDir` /
  `configChainPath` consts moved here from `core/bin/arcanum`.
