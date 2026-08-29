// Single source of truth for the native CLI command registry — see
// docs/agents/architecture/script-engine.md. Both `core/bin/arcanum` and
// `core/lib/core/dispatcher.js` import `COMMANDS` from here so that adding
// a migrated entrypoint only ever means adding one entry to this table.

/**
 * @typedef {object} CommandEntry
 * @property {string} module - path to the implementing module, relative to
 *   `core/lib/` (e.g. `commands/SpawnIssue.js`).
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
 *     wait-ci-and-merge), on `spawn-issue`, and on the `auto-fix-all-github-*`
 *     family (add-tag / cleanup-branch / has-shipit-label / pr-merge /
 *     pr-number / pr-state / remove-tag).
 *   - `'claude'` — `new ModuleClass(claudeContext)` where `claudeContext` is a
 *     `ClaudeContext` built from the leading anchor argument; that leading
 *     argument is stripped from the method args. Only `permission-grant`.
 *   - `'none'` / absent — `new ModuleClass()`, method args untouched. Applies
 *     to `dispatch-fixture`, `dispatch-fixture-crash`, `auto-fix-all-config-*`,
 *     `auto-fix-all-queue-*`, and `arcanum-update-run-update-*`.
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
    module: 'commands/ArcanumSplitIssueCreateSubIssue.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-create-sub-issue-file': {
    module: 'commands/ArcanumSplitIssueCreateSubIssueFile.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-finish': {
    module: 'commands/ArcanumSplitIssueFinish.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-split-issue-push-sub-issues': {
    module: 'commands/ArcanumSplitIssuePushSubIssues.js',
    method: 'run',
    context: 'repo'
  },
  'arcanum-update-run-update-check': { module: 'commands/ArcanumUpdateRunUpdate.js', method: 'check' },
  'arcanum-update-run-update-apply': { module: 'commands/ArcanumUpdateRunUpdate.js', method: 'apply' },
  'auto-fix-all-checkout-from-main': {
    module: 'commands/AutoFixAllCheckoutFromMain.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-cleanup-artifacts': {
    module: 'commands/AutoFixAllCleanupArtifacts.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-config-get': { module: 'commands/AutoFixAllConfig.js', method: 'get' },
  'auto-fix-all-config-is-enabled': { module: 'commands/AutoFixAllConfig.js', method: 'isEnabled' },
  'auto-fix-all-config-set': { module: 'commands/AutoFixAllConfig.js', method: 'set' },
  'auto-fix-all-config-toggle': { module: 'commands/AutoFixAllConfig.js', method: 'toggle' },
  'auto-fix-all-github-add-tag': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'addTag',
    context: 'repo'
  },
  'auto-fix-all-github-cleanup-branch': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'cleanupBranch',
    context: 'repo'
  },
  'auto-fix-all-github-has-shipit-label': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'hasShipitLabel',
    context: 'repo'
  },
  'auto-fix-all-github-pr-merge': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prMerge',
    context: 'repo'
  },
  'auto-fix-all-github-pr-number': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prNumber',
    context: 'repo'
  },
  'auto-fix-all-github-pr-state': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prState',
    context: 'repo'
  },
  'auto-fix-all-github-remove-tag': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'removeTag',
    context: 'repo'
  },
  'auto-fix-all-queue-empty': { module: 'commands/AutoFixAllQueue.js', method: 'empty' },
  'auto-fix-all-queue-list': { module: 'commands/AutoFixAllQueue.js', method: 'list' },
  'auto-fix-all-queue-next': { module: 'commands/AutoFixAllQueue.js', method: 'next' },
  'auto-fix-all-queue-pop': { module: 'commands/AutoFixAllQueue.js', method: 'pop' },
  'auto-fix-all-queue-push': { module: 'commands/AutoFixAllQueue.js', method: 'push' },
  'auto-fix-all-queue-save': { module: 'commands/AutoFixAllQueue.js', method: 'save' },
  'auto-fix-all-queue-wait-next': { module: 'commands/AutoFixAllQueue.js', method: 'waitNext' },
  'auto-fix-all-reply-comment': {
    module: 'commands/AutoFixAllReplyComment.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-wait-ci': {
    module: 'commands/AutoFixAllWaitCi.js',
    method: 'run',
    context: 'repo'
  },
  'auto-fix-all-wait-ci-and-merge': {
    module: 'commands/AutoFixAllWaitCiAndMerge.js',
    method: 'run',
    context: 'repo'
  },
  'checkout-safe-branch': {
    module: 'commands/SafeBranch.js',
    method: 'run',
    context: 'repo'
  },
  'dispatch-fixture': { module: 'commands/DispatchFixture.js', method: 'run', log: false },
  // dispatch-fixture-crash is deliberately left logged (entry.log
  // !== false, the default) — it exists specifically to prove that
  // InvocationLog#record runs and is awaited before the command's own
  // (crashing) module is invoked, so logging survives a crash. See
  // docs/agents/plans/244-add-logs-to-native-nodejs-calls/node.md.
  'dispatch-fixture-crash': { module: 'commands/DispatchFixture.js', method: 'crash' },
  'github-issue-create': {
    module: 'commands/GithubIssue.js',
    method: 'create',
    context: 'repo'
  },
  'github-issue-info': {
    module: 'commands/GithubIssue.js',
    method: 'info',
    context: 'repo'
  },
  'issue-state': {
    module: 'commands/IssueState.js',
    method: 'run',
    context: 'repo'
  },
  'list-agents': {
    module: 'commands/ListAgents.js',
    method: 'run',
    context: 'repo'
  },
  'permission-grant': { module: 'commands/PermissionGrant.js', method: 'run', context: 'claude' },
  'resolve-and-fetch': {
    module: 'commands/ResolveAndFetch.js',
    method: 'run',
    context: 'repo'
  },
  'resolve-id-and-file': {
    module: 'commands/ResolveIdAndFile.js',
    method: 'run',
    context: 'repo'
  },
  'resolve-plan-paths': {
    module: 'commands/ResolvePlanPaths.js',
    method: 'run',
    context: 'repo'
  },
  'spawn-issue': { module: 'commands/SpawnIssue.js', method: 'run', context: 'repo' }
};
