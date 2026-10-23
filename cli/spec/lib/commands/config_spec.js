import KeyRegistry from '../../../../shared/lib/config/KeyRegistry.js';
import { SUBCOMMANDS, SUBCOMMAND_OPTIONS, options, run } from '../../../lib/commands/config.js';
import { UsageError } from '../../../lib/exitCodes.js';
import { fakeIo } from '../../support/fakeIo.js';

describe('commands/config', () => {
  let io;

  beforeEach(() => {
    io = fakeIo();
  });

  it('prints its help, listing every registry key, for --help', async () => {
    expect(await run({ positionals: [], values: { help: true }, io })).toBe(0);

    for (const entry of new KeyRegistry().entries()) {
      expect(io.out()).toContain(entry.key);
    }

    expect(io.err()).toBe('');
  });

  it('lists the keys of an injected registry', async () => {
    const registry = new KeyRegistry({
      format_version: 1,
      keys: [{ key: 'only.key', type: 'string', tiers: ['repo'], description: 'The only key' }]
    });

    expect(await run({ positionals: [], values: { help: true }, io, registry })).toBe(0);
    expect(io.out()).toContain('only.key');
    expect(io.out()).toContain('The only key');
    expect(io.out()).not.toContain('engine.mode');
  });

  it('prints its help on stderr and exits 2 with no subcommand', async () => {
    expect(await run({ positionals: [], values: {}, io })).toBe(2);
    expect(io.out()).toBe('');
    expect(io.err()).toContain('Usage: arcanum config');
  });

  it('throws a UsageError on an unknown subcommand', async () => {
    await expectAsync(run({ positionals: ['nope'], values: {}, io })).toBeRejectedWithError(UsageError, /nope/);
  });

  it('throws on an inherited property name', async () => {
    await expectAsync(run({ positionals: ['toString'], values: {}, io })).toBeRejectedWithError(UsageError);
  });

  it('merges every subcommand\'s flags with the tier flags', () => {
    expect(Object.keys(options).sort()).toEqual(
      ['all-tiers', 'force', 'global', 'local', 'lock-timeout', 'repo', 'string']
    );
    expect(SUBCOMMAND_OPTIONS.force.only).toEqual(['set', 'unset']);
  });

  describe('shared checks', () => {
    let spy;

    beforeEach(() => {
      spy = spyOn(SUBCOMMANDS.get, 'run').and.resolveTo(0);
    });

    it('passes the args and the tier to the subcommand', async () => {
      expect(await run({ positionals: ['get', 'a.b'], values: { local: true }, io })).toBe(0);
      expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({ args: ['a.b'], tier: 'local' }));
    });

    it('refuses a flag the subcommand does not accept', async () => {
      await expectAsync(run({ positionals: ['get', 'k'], values: { string: true }, io }))
        .toBeRejectedWithError(UsageError, '--string is only accepted by set, not get');
    });

    it('refuses conflicting tier flags', async () => {
      await expectAsync(run({ positionals: ['get', 'k'], values: { global: true, local: true }, io }))
        .toBeRejectedWithError(UsageError, /cannot be combined/);
    });

    it('refuses a bad arity', async () => {
      await expectAsync(run({ positionals: ['get'], values: {}, io })).toBeRejectedWithError(UsageError, /needs <key>/);
    });

    it('refuses a key with an empty segment', async () => {
      await expectAsync(run({ positionals: ['get', 'a..b'], values: {}, io }))
        .toBeRejectedWithError(UsageError, /may not be empty/);
    });

    it('refuses a tier flag on info', async () => {
      await expectAsync(run({ positionals: ['info'], values: { repo: true }, io }))
        .toBeRejectedWithError(UsageError, '--repo is not accepted by info');
    });
  });
});
