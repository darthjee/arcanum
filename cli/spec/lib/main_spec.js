import { COMMANDS, CLI_VERSION, MIGRATION_VERSIONS, run } from '../../lib/main.js';
import { fakeIo } from '../support/fakeIo.js';

describe('main', () => {
  let io;

  beforeEach(() => {
    io = fakeIo();
  });

  describe('run', () => {
    it('prints the top-level usage on stdout and exits 0 for --help', async () => {
      expect(await run(['--help'], { io })).toBe(0);
      expect(io.out()).toContain('Usage: arcanum <command>');
      expect(io.out()).toContain('config');
      expect(io.err()).toBe('');
    });

    it('accepts -h as --help', async () => {
      expect(await run(['-h'], { io })).toBe(0);
      expect(io.out()).toContain('Usage: arcanum <command>');
    });

    it('prints the version for --version', async () => {
      expect(await run(['--version'], { io, version: '9.8.7' })).toBe(0);
      expect(io.out()).toBe('arcanum-cli 9.8.7\n');
    });

    it('prints a JSON version for --version --json', async () => {
      expect(await run(['--version', '--json'], { io, version: '9.8.7' })).toBe(0);
      expect(JSON.parse(io.out())).toEqual({ version: '9.8.7' });
      expect(io.out().endsWith('}\n')).toBeTrue();
    });

    it('reports the source-run version without a build define', async () => {
      expect(await run(['--version'], { io })).toBe(0);
      expect(io.out()).toBe(`arcanum-cli ${CLI_VERSION}\n`);
      expect(CLI_VERSION).toBe('0.0.0-dev');
    });

    it('prints usage on stderr and exits 2 with no command', async () => {
      expect(await run([], { io })).toBe(2);
      expect(io.out()).toBe('');
      expect(io.err()).toContain('Usage: arcanum <command>');
    });

    it('exits 2 on an unknown command', async () => {
      expect(await run(['nope'], { io })).toBe(2);
      expect(io.out()).toBe('');
      expect(io.err()).toContain('arcanum: unknown command \'nope\'');
      expect(io.err()).toContain('arcanum --help');
    });

    it('exits 2 on an unknown flag', async () => {
      expect(await run(['--bogus'], { io })).toBe(2);
      expect(io.err()).toContain('arcanum: ');
    });

    it('dispatches to the config command, with global flags in any position', async () => {
      expect(await run(['config', '--help'], { io })).toBe(0);
      expect(io.out()).toContain('Usage: arcanum config');
    });

    it('maps an error thrown by a command to its exit code', async () => {
      const error = Object.assign(new Error('timed out'), { code: 'LOCK_TIMEOUT' });

      spyOn(COMMANDS.config, 'run').and.throwError(error);

      expect(await run(['config'], { io })).toBe(6);
      expect(io.err()).toBe('arcanum: timed out\n');
    });

    it('finds the command after a --repo <path> and a --claude-config-dir value', async () => {
      const spy = spyOn(COMMANDS.config, 'run').and.resolveTo(0);

      expect(await run(['--repo', './x', '--claude-config-dir', '/d', 'config', 'get', 'k', '--repo'], { io })).toBe(0);

      const context = spy.calls.mostRecent().args[0];

      expect(context.positionals).toEqual(['get', 'k']);
      expect(context.values.repo).toBeTrue();
      expect(context.targeting).toEqual({ repo: './x', claudeConfigDir: '/d' });
      expect(context.resolveTargets).toEqual(jasmine.any(Function));
    });

    it('treats --repo <key> as the tier flag', async () => {
      const spy = spyOn(COMMANDS.config, 'run').and.resolveTo(0);

      expect(await run(['config', 'get', '--repo', 'engine.mode'], { io })).toBe(0);
      expect(spy.calls.mostRecent().args[0].positionals).toEqual(['get', 'engine.mode']);
      expect(spy.calls.mostRecent().args[0].targeting.repo).toBeUndefined();
    });

    it('passes the tokens after -- as positionals', async () => {
      const spy = spyOn(COMMANDS.config, 'run').and.resolveTo(0);

      expect(await run(['config', 'set', 'k', '--global', '--', '-1'], { io })).toBe(0);
      expect(spy.calls.mostRecent().args[0].positionals).toEqual(['set', 'k', '-1']);
    });

    it('reports a non-Error throw', async () => {
      spyOn(COMMANDS.config, 'run').and.callFake(() => {
        throw 'boom';
      });

      expect(await run(['config'], { io })).toBe(1);
      expect(io.err()).toBe('arcanum: boom\n');
    });
  });

  describe('MIGRATION_VERSIONS', () => {
    it('is empty per scope in a source run', () => {
      expect(MIGRATION_VERSIONS).toEqual({ repo: [], local: [], global: [] });
    });
  });
});
