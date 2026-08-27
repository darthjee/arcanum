/**
 * Generic swallow-and-retry wrapper, extracted from
 * `AutoFixAllWaitCi`'s own `_safeFetch` — deliberately speculative reuse
 * (see `docs/agents/plans/300-refactor-autofixallwaitci/`): today
 * `PrChecker` is its only caller, but the shape (await `fn()`, swallow
 * any error into `null`) is generic enough to reuse should another
 * transient-error-tolerant poll loop need it later.
 */
class SafeFetcher {
  /**
   * Run `fn`, swallowing any thrown/rejected error into `null`.
   * @param {Function} fn - a zero-argument async function to invoke.
   * @returns {Promise<*>} `fn`'s resolved value, or `null` if it threw or
   *   rejected.
   */
  async run(fn) {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

export default SafeFetcher;
