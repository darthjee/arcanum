// Single source of truth for the native CLI command registry — see
// docs/agents/architecture/script-engine.md. Both `core/bin/arcanum` and
// `core/lib/core/dispatcher.js` import `COMMANDS` from here so that adding
// a migrated entrypoint only ever means adding one entry to this table.

/**
 * @typedef {object} CommandEntry
 * @property {string} module - path to the implementing module, relative to
 *   `core/lib/` (e.g. `commands/shared/SpawnIssue.js`).
 * @property {string} method - method to invoke on the module's default export.
 * @property {boolean} [log] - `false` to skip `InvocationLog` recording for
 *   this command; any other value (or absent) means the invocation is logged.
 * @property {'repo'|'claude'|'none'} [context] - how the dispatcher builds the
 *   module instance from the leading argument (absent ≡ `'none'`):
 *   - `'repo'` — `new ModuleClass(repoContext)` where `repoContext` is a
 *     `RepoContext` built from the leading `repoPath` argument; that leading
 *     argument is stripped from the method args. Set on the
 *     `arcanum-split-issue-*` and `auto-fix-all-*` lifecycle commands
 *     (checkout-from-main / cleanup-artifacts / reply-comment / wait-ci /
 *     wait-ci-and-merge), on `spawn-issue`, on the `auto-fix-all-github-*`
 *     family (add-tag / cleanup-branch / has-shipit-label / pr-merge /
 *     pr-number / pr-state / remove-tag), and on the `auto-fix-all-queue-*`
 *     family (empty / list / next / pop / push / save / wait-next) — where
 *     `save` / `push` keep the Dispatcher `RepoContext#validate()` and the
 *     five file-only subcommands set `validateRepoPath: false` (their
 *     `repoPath` is only a queue-file path prefix).
 *   - `'claude'` — `new ModuleClass(claudeContext)` where `claudeContext` is a
 *     `ClaudeContext` built from the leading anchor argument; that leading
 *     argument is stripped from the method args. Only `permission-grant-add`.
 *   - `'none'` / absent — `new ModuleClass()`, method args untouched. Applies
 *     to `dispatch-fixture-crash`, `auto-fix-all-config-*`, and
 *     `arcanum-update-run-update-*`.
 * @property {boolean} [validateRepoPath] - defaults to `true` for
 *   `context: 'repo'`; set `false` to skip the Dispatcher-level
 *   `RepoContext#validate()` (e.g. entries with their own not-a-repo error
 *   contract). No effect for `context: 'claude'` / `'none'`.
 */

/**
 * Registry mapping each supported command name to the `core/lib/` module and
 * method that implements it. Keeping this table as the single source of truth
 * is what lets the router stay generic: adding a migrated entrypoint only ever
 * means adding one entry here.
 * @type {Object<string, CommandEntry>}
 */
export const COMMANDS = {
  'arcanum-split-issue-create-sub-issue': {
    module: 'commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-create-sub-issue-file': {
    module: 'commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-finish': {
    module: 'commands/arcanum-split-issue/ArcanumSplitIssueFinish.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-push-sub-issues': {
    module: 'commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-update-run-update-check': { module: 'commands/arcanum-update/ArcanumUpdateRunUpdate.js', method: 'check' },
  'arcanum-update-run-update-apply': { module: 'commands/arcanum-update/ArcanumUpdateRunUpdate.js', method: 'apply' },
  'auto-fix-all-checkout-from-main': {
    module: 'commands/auto-fix-all/AutoFixAllCheckoutFromMain.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-cleanup-artifacts': {
    module: 'commands/auto-fix-all/AutoFixAllCleanupArtifacts.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-config-get': { module: 'commands/auto-fix-all/AutoFixAllConfig.js', method: 'get' },
  'auto-fix-all-config-is-enabled': { module: 'commands/auto-fix-all/AutoFixAllConfig.js', method: 'isEnabled' },
  'auto-fix-all-config-set': { module: 'commands/auto-fix-all/AutoFixAllConfig.js', method: 'set' },
  'auto-fix-all-config-toggle': { module: 'commands/auto-fix-all/AutoFixAllConfig.js', method: 'toggle' },
  'auto-fix-all-github-add-tag': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'addTag',
    context: 'repo'
  },
  'auto-fix-all-github-cleanup-branch': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'cleanupBranch',
    context: 'repo'
  },
  'auto-fix-all-github-has-shipit-label': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'hasShipitLabel',
    context: 'repo'
  },
  'auto-fix-all-github-pr-merge': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'prMerge',
    context: 'repo'
  },
  'auto-fix-all-github-pr-number': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'prNumber',
    context: 'repo'
  },
  'auto-fix-all-github-pr-state': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'prState',
    context: 'repo'
  },
  'auto-fix-all-github-remove-tag': {
    module: 'commands/auto-fix-all/AutoFixAllGithub.js',
    method: 'removeTag',
    context: 'repo'
  },
  'auto-fix-all-queue-empty': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'empty',
    context: 'repo',
    validateRepoPath: false
  },
  'auto-fix-all-queue-list': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'list',
    context: 'repo',
    validateRepoPath: false
  },
  'auto-fix-all-queue-next': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'next',
    context: 'repo',
    validateRepoPath: false
  },
  'auto-fix-all-queue-pop': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'pop',
    context: 'repo',
    validateRepoPath: false
  },
  'auto-fix-all-queue-push': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'push',
    context: 'repo'
  },
  'auto-fix-all-queue-save': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'save',
    context: 'repo'
  },
  'auto-fix-all-queue-wait-next': {
    module: 'commands/auto-fix-all/AutoFixAllQueue.js',
    method: 'waitNext',
    context: 'repo',
    validateRepoPath: false
  },
  'auto-fix-all-reply-comment': {
    module: 'commands/auto-fix-all/AutoFixAllReplyComment.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-wait-ci': {
    module: 'commands/auto-fix-all/AutoFixAllWaitCi.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-wait-ci-and-merge': {
    module: 'commands/auto-fix-all/AutoFixAllWaitCiAndMerge.js',
    method: 'run',
    context: 'repo'
  },
  'checkout-safe-branch': {
    module: 'commands/shared/SafeBranch.js',
    method: 'run',
    context: 'repo'
  },
  // dispatch-fixture-crash is deliberately left logged (entry.log
  // !== false, the default) — it exists specifically to prove that
  // InvocationLog#record runs and is awaited before the command's own
  // (crashing) module is invoked, so logging survives a crash. See
  // docs/agents/plans/244-add-logs-to-native-nodejs-calls/node.md.
  // As of #342 this entry backs only the process-level crash-survival
  // proof in core/spec/bin/arcanum_spec.js, which spawns the real
  // bin/arcanum binary and has no mocking seam. dispatcher_spec.js's
  // unit-level crash-survival tests were decoupled from it — they now
  // anchor on auto-fix-all-config-get plus a mocked commandInstance() —
  // so do not reintroduce a unit-level dependency on this entry.
  'dispatch-fixture-crash': { module: 'commands/shared/DispatchFixture.js', method: 'crash' },
  'github-issue-create': {
    module: 'commands/shared/GithubIssue.js',
    method: 'create',
    context: 'repo'
  },
  'github-issue-info': {
    module: 'commands/shared/GithubIssue.js',
    method: 'info',
    context: 'repo',
    validateRepoPath: false
  },
  'issue-state': {
    module: 'commands/shared/IssueState.js',
    method: 'run',
    context: 'repo'
  },
  'list-agents': {
    module: 'commands/shared/ListAgents.js',
    method: 'run',
    context: 'repo'
  },
  'permission-grant-add': { module: 'commands/shared/PermissionGrant.js', method: 'add', context: 'claude' },
  'resolve-and-fetch': {
    module: 'commands/shared/ResolveAndFetch.js',
    method: 'run',
    context: 'repo'
  },
  'resolve-id-and-file': {
    module: 'commands/shared/ResolveIdAndFile.js',
    method: 'run',
    context: 'repo'
  },
  'resolve-plan-paths': {
    module: 'commands/shared/ResolvePlanPaths.js',
    method: 'run',
    context: 'repo'
  },
  'spawn-issue': { module: 'commands/shared/SpawnIssue.js', method: 'run', context: 'repo' }
};
