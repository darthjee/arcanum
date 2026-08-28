import { COMMANDS } from '../../../lib/core/commands.js';

describe('COMMANDS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThan(0);
  });

  it('keeps log: false on dispatch-fixture', () => {
    expect(COMMANDS['dispatch-fixture'].log).toBe(false);
  });

  it('sets takesRepoContext on the migrated arcanum-split-issue entries and the test fixture', () => {
    const withFlag = Object.keys(COMMANDS).filter((name) => COMMANDS[name].takesRepoContext);

    expect(withFlag).toEqual([
      'arcanum-split-issue-create-sub-issue-file',
      'arcanum-split-issue-finish',
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
