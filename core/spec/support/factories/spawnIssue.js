import RepoContext from '../../../lib/context/RepoContext.js';

export const REPO_REF = 'darthjee/arcanum';
export const DOMAIN = 'github.com';
export const CREATE_OUTPUT =
  'ID=42\nTITLE=New issue\nFILE=docs/agents/issues/42-new-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n';
export const USAGE = 'Usage: spawn-issue <repo_path> <parent_id> <title> <body_file> [--as-subissue]';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} the deps object passed to `new SpawnIssue(context, deps)`.
 */
export function stubDeps(overrides = {}) {
  return {
    sleepFn: jasmine.createSpy('sleepFn').and.resolveTo(undefined),
    labelApplicator: { apply: jasmine.createSpy('apply').and.resolveTo(undefined) },
    issueLinker: { link: jasmine.createSpy('link').and.resolveTo(undefined) },
    ...overrides
  };
}

/**
 * Build a real `RepoContext` wrapping fake low-level collaborators —
 * mirrors `AutoFixAllWaitCi_spec.js`'s `newWaitCi` / the other
 * `context: 'repo'` command specs.
 * @param {string} repoPath - the context's repo path (the per-test temp dir,
 *   or `''` for the no-repoPath validation test).
 * @param {object} [opts] - context wiring overrides.
 * @param {object} [opts.origin] - fake git-origin resolver.
 * @param {object} [opts.configChain] - fake 3-tier config reader.
 * @param {object} [opts.githubIssueService] - fake GitHub issue creator.
 * @returns {RepoContext} the assembled context.
 */
export function buildContext(repoPath, { origin, configChain, githubIssueService } = {}) {
  return new RepoContext({
    repoPath,
    origin: origin ?? { resolve: jasmine.createSpy('resolve').and.resolveTo({ domain: DOMAIN, repo: REPO_REF }) },
    configChain: configChain ?? { read: jasmine.createSpy('read').and.resolveTo(undefined) },
    repoPathValidator: { validate: jasmine.createSpy('validate').and.resolveTo(undefined) },
    githubIssueService
  });
}
