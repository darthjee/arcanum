import { COMMANDS } from '../../../lib/core/commands.js';

describe('COMMANDS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThan(0);
  });

  it('sets context: \'repo\' on the migrated arcanum-split-issue, auto-fix-all lifecycle, auto-fix-issue-commit-change, auto-fix-issue-create-branch, auto-fix-issue-merge-main, auto-fix-all-github, auto-fix-issue-github, auto-monitor-issue-pr-resolve-pr-number, auto-monitor-pr-monitor-pr, auto-new-issue-commit-issue, auto-plan-issue-commit-plan, discuss-issue-render-issue, github-issue, init-claude, auto-fix-all-queue, monitor-issues and spawn-issue entries', () => {
    const withRepoContext = Object.keys(COMMANDS).filter((name) => COMMANDS[name].context === 'repo');

    expect(withRepoContext).toEqual([
      'arcanum-split-issue-create-sub-issue',
      'arcanum-split-issue-create-sub-issue-file',
      'arcanum-split-issue-finish',
      'arcanum-split-issue-push-sub-issues',
      'auto-fix-all-checkout-from-main',
      'auto-fix-all-cleanup-artifacts',
      'auto-fix-all-github-add-tag',
      'auto-fix-all-github-cleanup-branch',
      'auto-fix-all-github-has-shipit-label',
      'auto-fix-all-github-pr-merge',
      'auto-fix-all-github-pr-number',
      'auto-fix-all-github-pr-state',
      'auto-fix-all-github-remove-tag',
      'auto-fix-all-queue-empty',
      'auto-fix-all-queue-list',
      'auto-fix-all-queue-next',
      'auto-fix-all-queue-pop',
      'auto-fix-all-queue-push',
      'auto-fix-all-queue-save',
      'auto-fix-all-queue-wait-next',
      'auto-fix-all-reply-comment',
      'auto-fix-all-wait-ci',
      'auto-fix-all-wait-ci-and-merge',
      'auto-fix-issue-commit-change',
      'auto-fix-issue-create-branch',
      'auto-fix-issue-github-info',
      'auto-fix-issue-github-pr-create',
      'auto-fix-issue-github-pr-view',
      'auto-fix-issue-github-pr-ready',
      'auto-fix-issue-merge-main',
      'auto-monitor-issue-pr-resolve-pr-number',
      'auto-monitor-pr-monitor-pr',
      'auto-new-issue-commit-issue',
      'auto-plan-issue-commit-plan',
      'checkout-safe-branch',
      'discuss-issue-render-issue',
      'github-issue-create',
      'github-issue-fetch',
      'github-issue-info',
      'github-issue-mark-created',
      'github-issue-mark-enhancing',
      'github-issue-mark-planning',
      'github-issue-mark-ready',
      'github-issue-mark-refined',
      'github-issue-mark-split',
      'github-issue-update',
      'init-claude-set-ci-ignored-patterns',
      'init-claude-setup-templates',
      'init-claude-stamp-arcanum-version',
      'issue-state',
      'list-agents',
      'monitor-issues-github-remove-tag',
      'monitor-issues-monitor-issues',
      'monitor-issues-rewrite-queue-pop',
      'monitor-issues-rewrite-queue-push',
      'resolve-and-fetch',
      'resolve-id-and-file',
      'resolve-plan-paths',
      'spawn-issue'
    ]);
  });

  it('sets context: \'claude\' on permission-grant-add', () => {
    expect(COMMANDS['permission-grant-add'].context).toBe('claude');
    expect(COMMANDS['permission-grant-add'].method).toBe('add');
  });

  it('sets context: \'claude\' on arcanum-update-run-update-check and arcanum-update-run-update-apply', () => {
    expect(COMMANDS['arcanum-update-run-update-check'].context).toBe('claude');
    expect(COMMANDS['arcanum-update-run-update-check'].method).toBe('check');
    expect(COMMANDS['arcanum-update-run-update-apply'].context).toBe('claude');
    expect(COMMANDS['arcanum-update-run-update-apply'].method).toBe('apply');
  });

  it('sets validateRepoPath: false on the file-only auto-fix-all-queue subcommands, github-issue-info, the github-issue-mark-* family, github-issue-update, the init-claude-* family and the monitor-issues-rewrite-queue-* family', () => {
    const skipValidation = Object.keys(COMMANDS).filter((name) => COMMANDS[name].validateRepoPath === false);

    expect(skipValidation).toEqual([
      'auto-fix-all-queue-empty',
      'auto-fix-all-queue-list',
      'auto-fix-all-queue-next',
      'auto-fix-all-queue-pop',
      'auto-fix-all-queue-wait-next',
      'github-issue-info',
      'github-issue-mark-created',
      'github-issue-mark-enhancing',
      'github-issue-mark-planning',
      'github-issue-mark-ready',
      'github-issue-mark-refined',
      'github-issue-mark-split',
      'github-issue-update',
      'init-claude-set-ci-ignored-patterns',
      'init-claude-setup-templates',
      'init-claude-stamp-arcanum-version',
      'monitor-issues-rewrite-queue-pop',
      'monitor-issues-rewrite-queue-push'
    ]);
  });

  it('routes the monitor-issues-config-* family to MonitorIssuesConfig with no context', () => {
    const expected = {
      'monitor-issues-config-get': 'get',
      'monitor-issues-config-is-enabled': 'isEnabled',
      'monitor-issues-config-set': 'set',
      'monitor-issues-config-toggle': 'toggle'
    };

    Object.entries(expected).forEach(([name, method]) => {
      expect(COMMANDS[name]).toEqual({ module: 'commands/monitor-issues/MonitorIssuesConfig.js', method });
    });
  });

  it('routes github-issue-fetch/github-issue-update to GithubIssue#fetchIssue/#update', () => {
    expect(COMMANDS['github-issue-fetch']).toEqual({
      module: 'commands/shared/GithubIssue.js',
      method: 'fetchIssue',
      context: 'repo'
    });
    expect(COMMANDS['github-issue-update']).toEqual({
      module: 'commands/shared/GithubIssue.js',
      method: 'update',
      context: 'repo',
      validateRepoPath: false
    });
  });

  it('routes the github-issue-mark-* family to GithubIssueMark#mark*', () => {
    const expected = {
      'github-issue-mark-created': 'markCreated',
      'github-issue-mark-enhancing': 'markEnhancing',
      'github-issue-mark-planning': 'markPlanning',
      'github-issue-mark-ready': 'markReady',
      'github-issue-mark-refined': 'markRefined',
      'github-issue-mark-split': 'markSplit'
    };

    Object.entries(expected).forEach(([name, method]) => {
      expect(COMMANDS[name]).toEqual({
        module: 'commands/shared/GithubIssueMark.js',
        method,
        context: 'repo',
        validateRepoPath: false
      });
    });
  });

  it('routes the init-claude-* family to their InitClaude* commands#run', () => {
    const expected = {
      'init-claude-set-ci-ignored-patterns': 'InitClaudeSetCiIgnoredPatterns',
      'init-claude-setup-templates': 'InitClaudeSetupTemplates',
      'init-claude-stamp-arcanum-version': 'InitClaudeStampArcanumVersion'
    };

    Object.entries(expected).forEach(([name, className]) => {
      expect(COMMANDS[name]).toEqual({
        module: `commands/init-claude/${className}.js`,
        method: 'run',
        context: 'repo',
        validateRepoPath: false
      });
    });
  });

  it('gives every entry a module path and a method', () => {
    const malformed = Object.keys(COMMANDS).filter((name) => {
      const entry = COMMANDS[name];
      return typeof entry.module !== 'string' || typeof entry.method !== 'string';
    });

    expect(malformed).toEqual([]);
  });
});
