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
 * @property {boolean} [takesRepoContext] - when `true`, the command's
 *   constructor receives a `RepoContext` built from the leading `repoPath`
 *   argument, and that leading argument is stripped from the method args.
 *   Set on the `arcanum-split-issue-*` and `auto-fix-all-*` lifecycle
 *   commands (checkout-from-main / cleanup-artifacts / reply-comment /
 *   wait-ci / wait-ci-and-merge), on `spawn-issue`, and on the
 *   `auto-fix-all-github-*` family (add-tag / cleanup-branch /
 *   has-shipit-label / pr-merge / pr-number / pr-state / remove-tag).
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
    takesRepoContext: true
  },
  'arcanum-split-issue-create-sub-issue-file': {
    module: 'commands/ArcanumSplitIssueCreateSubIssueFile.js',
    method: 'run',
    takesRepoContext: true
  },
  'arcanum-split-issue-finish': {
    module: 'commands/ArcanumSplitIssueFinish.js',
    method: 'run',
    takesRepoContext: true
  },
  'arcanum-split-issue-push-sub-issues': {
    module: 'commands/ArcanumSplitIssuePushSubIssues.js',
    method: 'run',
    takesRepoContext: true
  },
  'arcanum-update-run-update-check': { module: 'commands/ArcanumUpdateRunUpdate.js', method: 'check' },
  'arcanum-update-run-update-apply': { module: 'commands/ArcanumUpdateRunUpdate.js', method: 'apply' },
  'auto-fix-all-checkout-from-main': {
    module: 'commands/AutoFixAllCheckoutFromMain.js',
    method: 'run',
    takesRepoContext: true
  },
  'auto-fix-all-cleanup-artifacts': {
    module: 'commands/AutoFixAllCleanupArtifacts.js',
    method: 'run',
    takesRepoContext: true
  },
  'auto-fix-all-config-get': { module: 'commands/AutoFixAllConfig.js', method: 'get' },
  'auto-fix-all-config-is-enabled': { module: 'commands/AutoFixAllConfig.js', method: 'isEnabled' },
  'auto-fix-all-config-set': { module: 'commands/AutoFixAllConfig.js', method: 'set' },
  'auto-fix-all-config-toggle': { module: 'commands/AutoFixAllConfig.js', method: 'toggle' },
  'auto-fix-all-github-add-tag': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'addTag',
    takesRepoContext: true
  },
  'auto-fix-all-github-cleanup-branch': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'cleanupBranch',
    takesRepoContext: true
  },
  'auto-fix-all-github-has-shipit-label': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'hasShipitLabel',
    takesRepoContext: true
  },
  'auto-fix-all-github-pr-merge': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prMerge',
    takesRepoContext: true
  },
  'auto-fix-all-github-pr-number': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prNumber',
    takesRepoContext: true
  },
  'auto-fix-all-github-pr-state': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'prState',
    takesRepoContext: true
  },
  'auto-fix-all-github-remove-tag': {
    module: 'commands/AutoFixAllGithub.js',
    method: 'removeTag',
    takesRepoContext: true
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
    takesRepoContext: true
  },
  'auto-fix-all-wait-ci': {
    module: 'commands/AutoFixAllWaitCi.js',
    method: 'run',
    takesRepoContext: true
  },
  'auto-fix-all-wait-ci-and-merge': {
    module: 'commands/AutoFixAllWaitCiAndMerge.js',
    method: 'run',
    takesRepoContext: true
  },
  'checkout-safe-branch': {
    module: 'commands/SafeBranch.js',
    method: 'run',
    takesRepoContext: true
  },
  'dispatch-fixture': { module: 'commands/DispatchFixture.js', method: 'run', log: false },
  // dispatch-fixture-crash is deliberately left logged (entry.log
  // !== false, the default) — it exists specifically to prove that
  // InvocationLog#record runs and is awaited before the command's own
  // (crashing) module is invoked, so logging survives a crash. See
  // docs/agents/plans/244-add-logs-to-native-nodejs-calls/node.md.
  'dispatch-fixture-crash': { module: 'commands/DispatchFixture.js', method: 'crash' },
  // dispatch-fixture-repo-context is test-only: it exercises the
  // `takesRepoContext` flag-on path end to end through the real registry.
  // Removed together with the flag in #308 sub-issue 6.
  'dispatch-fixture-repo-context': {
    module: 'commands/DispatchFixtureRepoContext.js',
    method: 'run',
    takesRepoContext: true,
    log: false
  },
  'github-issue-create': {
    module: 'commands/GithubIssue.js',
    method: 'create',
    takesRepoContext: true
  },
  'github-issue-info': {
    module: 'commands/GithubIssue.js',
    method: 'info',
    takesRepoContext: true
  },
  'issue-state': {
    module: 'commands/IssueState.js',
    method: 'run',
    takesRepoContext: true
  },
  'list-agents': {
    module: 'commands/ListAgents.js',
    method: 'run',
    takesRepoContext: true
  },
  'permission-grant': { module: 'commands/PermissionGrant.js', method: 'run' },
  'resolve-and-fetch': {
    module: 'commands/ResolveAndFetch.js',
    method: 'run',
    takesRepoContext: true
  },
  'resolve-id-and-file': {
    module: 'commands/ResolveIdAndFile.js',
    method: 'run',
    takesRepoContext: true
  },
  'resolve-plan-paths': {
    module: 'commands/ResolvePlanPaths.js',
    method: 'run',
    takesRepoContext: true
  },
  'spawn-issue': { module: 'commands/SpawnIssue.js', method: 'run', takesRepoContext: true }
};
