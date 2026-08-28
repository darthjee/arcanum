/**
 * Throwaway test scaffolding for the `takesRepoContext` command-registry
 * flag. Unlike `DispatchFixture`, this fixture receives a `RepoContext` at
 * construction and echoes what it got, so `Dispatcher`'s flag-on branch
 * (construct with `repoContext`, strip the leading `repoPath` arg) can be
 * exercised end to end through the real `COMMANDS` registry. Kept as a
 * separate module so `DispatchFixture`'s byte-identical shell-parity
 * contract stays untouched. Removed together with the flag in #308
 * sub-issue 6.
 */
class DispatchFixtureRepoContext {
  /**
   * @param {{ repoPath: string }} repoContext - the `RepoContext` built by
   *   `Dispatcher` from the leading `repoPath` CLI argument.
   */
  constructor(repoContext) {
    this.repoContext = repoContext;
  }

  /**
   * Produce a deterministic line proving both the `repoContext` received at
   * construction and that the leading `repoPath` argument was stripped from
   * the method args by `Dispatcher.commandArgs()`.
   * @param {...string} args - the command's own remaining arguments.
   * @returns {string} the fixture line, trailing newline included.
   */
  run(...args) {
    return `dispatch-fixture: repoPath=${this.repoContext.repoPath} args=${args.join(',')}\n`;
  }
}

export default DispatchFixtureRepoContext;
