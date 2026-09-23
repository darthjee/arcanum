/**
 * Build a fake `execFileAsync` implementation answering a single
 * command (`gh`, `git`, ...) through an ordered list of routes, so specs
 * never shell out for real. The first route whose `match` returns truthy
 * wins and its `respond` result (sync or async) is returned; `respond`
 * may throw to simulate a failure.
 * @param {string} command - the only command name the fake accepts; any
 *   other `cmd` throws `unexpected command: <cmd>`.
 * @param {Array<{match: function(string[], object): *, respond: function(string[], object): *}>} routes - ordered
 *   routes, each receiving `(args, options)`. When none matches, the
 *   fake throws `unexpected <command> invocation: <JSON args>`.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
export function fakeExecFileAsync(command, routes) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args, options = {}) => {
    if (cmd !== command) {
      throw new Error(`unexpected command: ${cmd}`);
    }

    const route = routes.find(({ match }) => match(args, options));

    if (!route) {
      throw new Error(`unexpected ${command} invocation: ${JSON.stringify(args)}`);
    }

    return route.respond(args, options);
  });
}

/**
 * Build a route matcher accepting any invocation whose leading args are
 * exactly `names` (e.g. `subcommand('issue', 'view')` matches
 * `['issue', 'view', '1', ...]`).
 * @param {...string} names - the expected leading args, in order.
 * @returns {function(string[]): boolean} a `match(args)` predicate for `fakeExecFileAsync`.
 */
export function subcommand(...names) {
  return (args) => names.every((name, index) => args[index] === name);
}
