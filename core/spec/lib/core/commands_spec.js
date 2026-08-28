import { COMMANDS } from '../../../lib/core/commands.js';

describe('COMMANDS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThan(0);
  });

  it('keeps log: false on dispatch-fixture', () => {
    expect(COMMANDS['dispatch-fixture'].log).toBe(false);
  });

  it('only sets takesRepoContext on the dispatch-fixture-repo-context test entry', () => {
    const withFlag = Object.keys(COMMANDS).filter((name) => COMMANDS[name].takesRepoContext);

    expect(withFlag).toEqual(['dispatch-fixture-repo-context']);
  });

  it('gives every entry a module path and a method', () => {
    const malformed = Object.keys(COMMANDS).filter((name) => {
      const entry = COMMANDS[name];
      return typeof entry.module !== 'string' || typeof entry.method !== 'string';
    });

    expect(malformed).toEqual([]);
  });
});
