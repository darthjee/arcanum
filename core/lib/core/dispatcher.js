import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMANDS } from './commands.js';
import RepoContext from '../context/RepoContext.js';
import InvocationLog from '../utils/logging/InvocationLog.js';

const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Three levels up from core/lib/core, mirroring how engine_dispatch.sh
// itself resolves core/bin/arcanum's path in the other direction.
const configChainPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'arcanum',
  '_lib',
  'config_chain.sh'
);

/**
 * Owns a single CLI invocation's dispatch: registry lookup, the
 * unknown-command error, `InvocationLog` recording (awaited before the
 * command module is imported, so a crashing command is still logged),
 * lazy `RepoContext` construction for the `takesRepoContext` flag-on
 * path, module resolution and invocation. See
 * docs/agents/architecture/script-engine.md.
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
   * Resolve the command to its module and run it.
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

    const instance = await this.commandInstance();
    return instance[this.entryMethod()](...this.commandArgs());
  }

  /**
   * Import the command's module and construct its default export, passing
   * the lazy `RepoContext` when the entry opts in via `takesRepoContext`.
   * @returns {Promise<object>} the constructed command instance.
   */
  async commandInstance() {
    const { default: ModuleClass } = await import(this.modulePath());
    return this.entry.takesRepoContext
      ? new ModuleClass(this.repoContext)
      : new ModuleClass();
  }

  /**
   * Lazily-built, memoized `RepoContext` for the leading `repoPath`
   * argument. Only constructed on the `takesRepoContext` flag-on path.
   * @returns {RepoContext} the context bound to `args[0]`.
   */
  get repoContext() {
    this._repoContext ??= new RepoContext({ repoPath: this.args[0] });
    return this._repoContext;
  }

  /**
   * The arguments to forward to the command method — with the leading
   * `repoPath` stripped when the entry takes a `RepoContext`.
   * @returns {string[]} the method arguments.
   */
  commandArgs() {
    return this.entry.takesRepoContext ? this.args.slice(1) : this.args;
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
