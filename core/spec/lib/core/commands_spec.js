import { COMMANDS } from '../../../lib/core/commands.js';

describe('COMMANDS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThan(0);
  });

  it('keeps log: false on dispatch-fixture', () => {
    expect(COMMANDS['dispatch-fixture'].log).toBe(false);
  });

  it('sets context: \'repo\' on the migrated arcanum-split-issue, auto-fix-all lifecycle, auto-fix-all-github and spawn-issue entries', () => {
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
      'auto-fix-all-reply-comment',
      'auto-fix-all-wait-ci',
      'auto-fix-all-wait-ci-and-merge',
      'checkout-safe-branch',
      'github-issue-create',
      'github-issue-info',
      'issue-state',
      'list-agents',
      'resolve-and-fetch',
      'resolve-id-and-file',
      'resolve-plan-paths',
      'spawn-issue'
    ]);
  });

  it('sets context: \'claude\' on permission-grant', () => {
    expect(COMMANDS['permission-grant'].context).toBe('claude');
  });

  it('gives every entry a module path and a method', () => {
    const malformed = Object.keys(COMMANDS).filter((name) => {
      const entry = COMMANDS[name];
      return typeof entry.module !== 'string' || typeof entry.method !== 'string';
    });

    expect(malformed).toEqual([]);
  });
});
