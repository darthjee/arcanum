/**
 * Build a plain repo-context stub for the specs of `ConfigChain` and
 * `RepoConfig`.
 *
 * A **reduced** copy of core's `createRepoContextMock`: core's factory
 * returns a real `RepoContext` (from `core/lib/context/`), which
 * `shared/spec` cannot import — spec support is copied, never imported
 * across folders. `ConfigChain` and `RepoConfig` only read
 * `repoContext.repoPath`, so a plain object is enough. Any extra
 * collaborator a spec passes (e.g. `configChain`) is kept as given.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.repoPath] - the target repo's local checkout
 *   path.
 * @returns {{repoPath: string}} a plain repo-context stub.
 */
export function createRepoContextMock({ repoPath = '/fake/repo', ...overrides } = {}) {
  return { ...overrides, repoPath };
}
