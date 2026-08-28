import { COMMANDS } from '../../../lib/core/commands.js';

describe('COMMANDS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThan(0);
  });

  it('keeps log: false on dispatch-fixture', () => {
    expect(COMMANDS['dispatch-fixture'].log).toBe(false);
  });

  it('sets takesRepoContext on the migrated arcanum-split-issue and auto-fix-all lifecycle entries and the test fixture', () => {
    const withFlag = Object.keys(COMMANDS).filter((name) => COMMANDS[name].takesRepoContext);

    expect(withFlag).toEqual([
      'arcanum-split-issue-create-sub-issue',
      'arcanum-split-issue-create-sub-issue-file',
      'arcanum-split-issue-finish',
      'arcanum-split-issue-push-sub-issues',
      'auto-fix-all-checkout-from-main',
      'auto-fix-all-cleanup-artifacts',
      'auto-fix-all-reply-comment',
      'auto-fix-all-wait-ci',
      'auto-fix-all-wait-ci-and-merge',
      'dispatch-fixture-repo-context'
    ]);
  });

  it('gives every entry a module path and a method', () => {
    const malformed = Object.keys(COMMANDS).filter((name) => {
      const entry = COMMANDS[name];
      return typeof entry.module !== 'string' || typeof entry.method !== 'string';
    });

    expect(malformed).toEqual([]);
  });
});
