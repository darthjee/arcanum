import { SHORTCUTS } from '../../lib/commands/config/shortcuts/index.js';
import {
  SHORTCUT_HELP, SUBCOMMAND_HELP, configUsage, formatRows, shortcutUsage, subcommandUsage, topLevelUsage
} from '../../lib/help.js';

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
      expect(usage).toContain('--claude-config-dir <dir>');
      expect(usage).not.toContain('not implemented');
    });
  });

  describe('subcommandUsage', () => {
    Object.keys(SUBCOMMAND_HELP).forEach((name) => {
      it(`prints the ${name} synopsis and the targeting flags`, () => {
        const usage = subcommandUsage(name);

        expect(usage).toMatch(new RegExp(`^Usage: arcanum config ${name}`));
        expect(usage).toContain('--json');
        expect(usage.endsWith('\n')).toBeTrue();
      });
    });

    it('lists each subcommand\'s own flags', () => {
      expect(subcommandUsage('get')).toContain('--all-tiers');
      expect(subcommandUsage('set')).toContain('--string');
      expect(subcommandUsage('unset')).toContain('--lock-timeout <seconds>');
      expect(subcommandUsage('unset')).not.toContain('--string');
    });
  });

  describe('shortcutUsage', () => {
    const names = Object.entries(SHORTCUTS).flatMap(([namespace, entry]) => (
      typeof entry === 'function' ? [namespace] : Object.keys(entry).map((name) => `${namespace} ${name}`)
    ));

    it('documents exactly the dispatched shortcuts', () => {
      expect(Object.keys(SHORTCUT_HELP).sort()).toEqual([...names].sort());
    });

    names.forEach((name) => {
      it(`prints the ${name} synopsis, its notes and the targeting flags`, () => {
        const [namespace, shortcut] = name.split(' ');
        const usage = shortcutUsage(namespace, shortcut);

        expect(usage).toMatch(new RegExp(`^Usage: arcanum config ${name}`));
        expect(usage).toContain(`${SHORTCUT_HELP[name].summary}.`);
        expect(usage).toContain('--json');
        expect(usage.endsWith('\n')).toBeTrue();
      });
    });

    it('lists a namespace\'s shortcuts without one', () => {
      const usage = shortcutUsage('auto-fix-all');

      expect(usage).toMatch(/^Usage: arcanum config auto-fix-all <shortcut>/);
      expect(usage).toContain('auto-fix-all clear-context [on|off | --unset]');
      expect(usage).toContain('auto-fix-all ignore-checks [list]');
      expect(usage).not.toContain('engine');
    });

    it('falls back to the namespace listing for an unknown shortcut', () => {
      expect(shortcutUsage('git', 'nope')).toMatch(/^Usage: arcanum config git <shortcut>/);
    });

    it('prints a one-shortcut namespace\'s usage whatever follows', () => {
      expect(shortcutUsage('engine', 'native')).toMatch(/^Usage: arcanum config engine \[shell/);
    });

    it('says ignore-checks patterns are case-insensitive regexes, not globs', () => {
      expect(shortcutUsage('auto-fix-all', 'ignore-checks')).toContain('case-insensitive regexes');
      expect(shortcutUsage('auto-fix-all', 'ignore-checks')).toContain('not globs');
    });

    it('lists the boolean tokens on boolean shortcuts', () => {
      expect(shortcutUsage('monitor-issues', 'clear-context')).toContain('on, off, true or false (lowercase)');
    });
  });

  describe('configUsage shortcuts', () => {
    it('lists every shortcut with its summary', () => {
      const usage = configUsage([]);

      for (const [name, help] of Object.entries(SHORTCUT_HELP)) {
        expect(usage).toContain(name);
        expect(usage).toContain(help.summary);
      }
    });
  });
});
