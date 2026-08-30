import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMANDS } from './commands.js';
import RepoContext from '../context/RepoContext.js';
import ClaudeContext from '../context/ClaudeContext.js';
import InvocationLog from '../utils/logging/InvocationLog.js';
import { resolveInstallPath } from '../utils/file/InstallRoot.js';

const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// The walk back to the arcanum install root lives in InstallRoot.js;
// this mirrors how engine_dispatch.sh itself resolves core/bin/arcanum's
// path in the other direction.
const configChainPath = resolveInstallPath('arcanum', '_lib', 'config_chain.sh');

/**
 * Owns a single CLI invocation's dispatch: registry lookup, the
 * unknown-command error, `InvocationLog` recording (awaited before the
 * command module is imported, so a crashing command is still logged),
 * lazy context construction for the `context: 'repo'` / `context: 'claude'`
 * paths, the `context: 'repo'` `repoPath` validation step (after `record`,
 * before the command module is imported), module resolution and
 * invocation. See docs/agents/architecture/script-engine.md.
 */
export default class Dispatcher {
  /**
   * @param {string} command - the command name, e.g. `dispatch-fixture`.
   * @param {string[]} args - the command's own remaining CLI arguments.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {InvocationLog} [deps.invocationLog] - the invocation logger;
   *   defaults to `new InvocationLog({ configChainPath })`.
   */
  constructor(command, args, { invocationLog } = {}) {
    this.command = command;
    this.args = args;
    this.entry = COMMANDS[command];
    this._invocationLog = invocationLog ?? new InvocationLog({ configChainPath });
  }

  /**
   * Resolve the command to its module and run it. On the `context: 'repo'`
   * path (unless the entry sets `validateRepoPath: false`), the leading
   * `repoPath` argument is validated via `RepoContext#validate()` — after
   * `record`, before the command module is imported.
   * @returns {Promise<*>} the command method's resolved return value; a
   *   returned promise is awaited, so the caller always gets a plain value.
   * @throws {Error} `unknown command '<command>'` when the command name is
   *   not in the registry.
   */
  async dispatch() {
    if (!this.entry) {
      throw new Error(`unknown command '${this.command}'`);
    }

    if (this.entry.log !== false) {
      await this._invocationLog.record(this.command);
    }

    if (
      this.entry.context === 'repo' &&
      this.entry.validateRepoPath !== false &&
      // The `&& this.args[0]` guard keeps shell parity for the
      // absent-leading-arg case (the command's own `USAGE` throw still
      // wins); whether to drop it is #333's call.
      this.args[0]
    ) {
      await this.repoContext.validate();
    }

    const instance = await this.commandInstance();
    return instance[this.entryMethod()](...this.commandArgs());
  }

  /**
   * Import the command's module and construct its default export, passing
   * the lazy context the entry opts into via `context`: a `RepoContext`
   * for `'repo'`, a `ClaudeContext` for `'claude'`, nothing for
   * `'none'` / absent.
   * @returns {Promise<object>} the constructed command instance.
   */
  async commandInstance() {
    const { default: ModuleClass } = await import(this.modulePath());
    if (this.entry.context === 'repo') {
      return new ModuleClass(this.repoContext);
    }
    if (this.entry.context === 'claude') {
      return new ModuleClass(this.claudeContext);
    }
    return new ModuleClass();
  }

  /**
   * Lazily-built, memoized `RepoContext` for the leading `repoPath`
   * argument. Only constructed on the `context: 'repo'` path.
   * @returns {RepoContext} the context bound to `args[0]`.
   */
  get repoContext() {
    this._repoContext ??= new RepoContext({ repoPath: this.args[0] });
    return this._repoContext;
  }

  /**
   * Lazily-built, memoized `ClaudeContext` for the leading `<anchor>`
   * argument. Only constructed on the `context: 'claude'` path.
   * @returns {ClaudeContext} the context bound to `args[0]`.
   */
  get claudeContext() {
    this._claudeContext ??= new ClaudeContext({ repoPath: this.args[0] });
    return this._claudeContext;
  }

  /**
   * @returns {boolean} whether the entry binds a context to the leading
   *   argument (`context: 'repo'` or `context: 'claude'`), meaning that
   *   argument is consumed by the constructor and stripped from the
   *   method args.
   */
  isContextBound() {
    return this.entry.context === 'repo' || this.entry.context === 'claude';
  }

  /**
   * The arguments to forward to the command method — with the leading
   * argument stripped when the entry binds a context to it.
   * @returns {string[]} the method arguments.
   */
  commandArgs() {
    return this.isContextBound() ? this.args.slice(1) : this.args;
  }

  /**
   * @returns {string} the method to invoke on the command's default export.
   */
  entryMethod() {
    return this.entry.method;
  }

  /**
   * @returns {string} the `file://` URL of the command's module under
   *   `core/lib/`, ready for dynamic `import()`.
   */
  modulePath() {
    return pathToFileURL(path.join(libDir, this.entry.module)).href;
  }
}
