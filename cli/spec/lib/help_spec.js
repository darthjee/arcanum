import { configUsage, formatRows, topLevelUsage } from '../../lib/help.js';

describe('help', () => {
  describe('formatRows', () => {
    it('aligns the second column', () => {
      expect(formatRows([['a', 'one'], ['long', 'two']])).toBe('  a     one\n  long  two');
    });

    it('trims trailing spaces when the second column is empty', () => {
      expect(formatRows([['a', '']])).toBe('  a');
    });

    it('returns an empty string for no rows', () => {
      expect(formatRows([])).toBe('');
    });
  });

  describe('topLevelUsage', () => {
    it('lists the config command and the meta flags', () => {
      const usage = topLevelUsage();

      expect(usage).toMatch(/^Usage: arcanum <command>/);
      expect(usage).toContain('config');
      expect(usage).toContain('--help');
      expect(usage).toContain('--version');
      expect(usage.endsWith('\n')).toBeTrue();
    });
  });

  describe('configUsage', () => {
    it('lists the subcommands and every given key with its description', () => {
      const usage = configUsage([
        { key: 'engine.mode', description: 'Script engine' },
        { key: 'git.email', description: 'Commit email' }
      ]);

      expect(usage).toMatch(/^Usage: arcanum config/);
      expect(usage).toContain('get <key>');
      expect(usage).toContain('info');
      expect(usage).toContain('  engine.mode  Script engine\n');
      expect(usage).toContain('  git.email    Commit email\n');
    });
  });
});
