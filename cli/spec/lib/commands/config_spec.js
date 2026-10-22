import KeyRegistry from '../../../../core/lib/shared/config/KeyRegistry.js';
import { run } from '../../../lib/commands/config.js';
import { UsageError } from '../../../lib/exitCodes.js';
import { fakeIo } from '../../support/fakeIo.js';

describe('commands/config', () => {
  let io;

  beforeEach(() => {
    io = fakeIo();
  });

  it('prints its help, listing every registry key, for --help', () => {
    expect(run({ positionals: [], values: { help: true }, io })).toBe(0);

    for (const entry of new KeyRegistry().entries()) {
      expect(io.out()).toContain(entry.key);
    }

    expect(io.out()).toContain('engine.mode');
    expect(io.err()).toBe('');
  });

  it('lists the keys of an injected registry', () => {
    const registry = new KeyRegistry({
      format_version: 1,
      keys: [{ key: 'only.key', type: 'string', tiers: ['repo'], description: 'The only key' }]
    });

    expect(run({ positionals: [], values: { help: true }, io, registry })).toBe(0);
    expect(io.out()).toContain('only.key  The only key');
    expect(io.out()).not.toContain('engine.mode');
  });

  it('prints its help on stderr and exits 2 with no subcommand', () => {
    expect(run({ positionals: [], values: {}, io })).toBe(2);
    expect(io.out()).toBe('');
    expect(io.err()).toContain('Usage: arcanum config');
  });

  it('throws a UsageError on an unknown subcommand', () => {
    expect(() => run({ positionals: ['nope'], values: {}, io })).toThrowError(UsageError, /nope/);
  });

  ['get', 'set', 'unset', 'list', 'info'].forEach((subcommand) => {
    it(`reports ${subcommand} as not implemented yet, exit 1`, () => {
      expect(run({ positionals: [subcommand], values: {}, io })).toBe(1);
      expect(io.err()).toBe(`arcanum: config ${subcommand} is not implemented yet\n`);
    });
  });
});
