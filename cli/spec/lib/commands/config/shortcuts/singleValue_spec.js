import { readFile } from 'node:fs/promises';
import path from 'node:path';
import KeyRegistry from '../../../../../../shared/lib/config/KeyRegistry.js';
import { SINGLE_VALUE } from '../../../../../lib/commands/config/shortcuts/singleValue.js';
import { writeTier } from '../../../../support/fixtures.js';
import { observable, shortcutHarness } from '../../../../support/shortcuts.js';

// Each single-value shortcut: its argv, its key, the tier holding a
// readable value, a value token with its generic equivalent, a tier
// override with whether the registry allows it.
const CASES = [
  { argv: ['engine'], key: 'engine.mode', seedTier: 'repo', seedValue: 'docker', token: 'native', generic: 'native', override: 'global' },
  { argv: ['git', 'safe-branch'], key: 'git.safe_branch', seedTier: 'local', seedValue: 'origin/dev', token: 'origin/next', generic: 'origin/next', override: 'repo' },
  { argv: ['git', 'merge-body'], key: 'git.merge_body_mode', seedTier: 'global', seedValue: 'coauthors', token: 'full', generic: 'full', override: 'global' },
  { argv: ['auto-fix-all', 'clear-context'], key: 'auto-fix-all.clear_context', seedTier: 'local', seedValue: true, token: 'on', generic: 'true', override: 'repo' },
  { argv: ['auto-fix-all', 'finish-on-empty-queue'], key: 'auto-fix-all.finish_on_empty_queue', seedTier: 'local', seedValue: true, token: 'off', generic: 'false', override: 'global' },
  { argv: ['monitor-issues', 'clear-context'], key: 'monitor-issues.clear_context', seedTier: 'local', seedValue: false, token: 'on', generic: 'true', override: 'repo' }
];

/**
 * @param {string} key - a dotted key.
 * @param {unknown} value - its value.
 * @returns {object} the nested object holding it.
 */
function nested(key, value) {
  return key.split('.').reduceRight((inner, segment) => ({ [segment]: inner }), value);
}

describe('config shortcuts: single-value', () => {
  const harness = shortcutHarness();
  const config = (...args) => ['config', ...args];

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  it('maps every shortcut to its key and default tier', () => {
    expect(Object.fromEntries(Object.entries(SINGLE_VALUE).map(([name, { key, tier }]) => [name, [key, tier]]))).toEqual({
      engine: ['engine.mode', 'local'],
      'git safe-branch': ['git.safe_branch', 'local'],
      'git merge-body': ['git.merge_body_mode', 'local'],
      'auto-fix-all clear-context': ['auto-fix-all.clear_context', 'local'],
      'auto-fix-all finish-on-empty-queue': ['auto-fix-all.finish_on_empty_queue', 'local'],
      'monitor-issues clear-context': ['monitor-issues.clear_context', 'local']
    });
  });

  for (const shortcut of CASES) {
    const { argv, key, seedTier, seedValue, token, generic, override } = shortcut;
    const name = argv.join(' ');
    const seeded = { [seedTier]: nested(key, seedValue) };
    const allowed = new KeyRegistry().lookup(key).tiers.includes(override);

    describe(name, () => {
      for (const json of [[], ['--json']]) {
        const mode = json.length ? ' (--json)' : '';

        it(`reads like config get${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(config(...argv, ...json), config('get', key, ...json), seeded);

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`reads an unset key like config get, with the registry default${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(config(...argv, ...json), config('get', key, ...json));

          expect(a.code).toBe(1);
          expect(a.out).toContain(json.length ? '"default":' : 'default:');
          expect(observable(a)).toEqual(observable(b));
        });

        it(`reads one tier like config get --${seedTier}${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, `--${seedTier}`, ...json), config('get', key, `--${seedTier}`, ...json), seeded
          );

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`reads every tier like config get --all-tiers${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, '--all-tiers', ...json), config('get', key, '--all-tiers', ...json), seeded
          );

          expect(observable(a)).toEqual(observable(b));
        });

        it(`sets like config set --local${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, token, ...json), config('set', key, generic, '--local', ...json)
          );

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`unsets like config unset --local${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, '--unset', ...json), config('unset', key, '--local', ...json), { local: nested(key, seedValue) }
          );

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`overrides the tier like config set --${override}${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, token, `--${override}`, ...json), config('set', key, generic, `--${override}`, ...json)
          );

          expect(a.code).toBe(allowed ? 0 : 3);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`overrides the unset tier like config unset --${override}${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config(...argv, '--unset', `--${override}`, ...json), config('unset', key, `--${override}`, ...json)
          );

          expect(a.code).toBe(allowed ? 0 : 3);
          expect(observable(a)).toEqual(observable(b));
        });
      }
    });
  }

  it('reads an unset key with no registry default like config get', async () => {
    const lookup = KeyRegistry.prototype.lookup;

    spyOn(KeyRegistry.prototype, 'lookup').and.callFake(function (key) {
      const entry = lookup.call(this, key);

      if (entry === null || key !== 'engine.mode') {
        return entry;
      }

      const rest = { ...entry };

      delete rest.default;

      return rest;
    });

    for (const json of [[], ['--json']]) {
      const { shortcut: a, generic: b } = await harness.both(config('engine', ...json), config('get', 'engine.mode', ...json));

      expect(a.code).toBe(1);
      expect(observable(a)).toEqual(observable(b));
    }

    const { shortcut: human } = await harness.both(config('engine'), config('get', 'engine.mode'));
    const { shortcut: json } = await harness.both(config('engine', '--json'), config('get', 'engine.mode', '--json'));

    expect(human.out).toBe('(unset)\n');
    expect(json.json().default).toBeNull();
  });

  it('prints the documented unset read', async () => {
    await harness.seed();

    expect((await harness.run(config('git', 'safe-branch'))).out).toBe('(unset; default: origin/main)\n');
    expect((await harness.run(config('git', 'safe-branch', '--json'))).json()).toEqual({
      key: 'git.safe_branch', set: false, value: null, source: null, default: 'origin/main'
    });
  });

  it('refuses an enum value like config set', async () => {
    const { shortcut: a, generic: b } = await harness.both(config('engine', 'NATIVE'), config('set', 'engine.mode', 'NATIVE', '--local'));

    expect(a.code).toBe(3);
    expect(observable(a)).toEqual(observable(b));
  });

  it('stores a ref as typed, even when it looks like JSON', async () => {
    await harness.seed();

    expect((await harness.run(config('git', 'safe-branch', '42'))).code).toBe(0);
    expect(JSON.parse(await readFile(harness.localFile, 'utf8'))).toEqual({ git: { safe_branch: '42' } });
  });

  it('stores off as a JSON false', async () => {
    await harness.seed();

    await harness.run(config('auto-fix-all', 'clear-context', 'off'));

    expect(JSON.parse(await readFile(harness.localFile, 'utf8'))).toEqual({ 'auto-fix-all': { clear_context: false } });
  });

  it('passes --lock-timeout to the write', async () => {
    const { shortcut: a, generic: b } = await harness.both(
      config('engine', 'native', '--lock-timeout', '1'), config('set', 'engine.mode', 'native', '--local', '--lock-timeout', '1')
    );

    expect(a.code).toBe(0);
    expect(observable(a)).toEqual(observable(b));
  });

  describe('boolean tokens', () => {
    for (const [token, value] of [['on', true], ['true', true], ['off', false], ['false', false]]) {
      it(`stores ${token} as ${value}`, async () => {
        await harness.seed();

        expect((await harness.run(config('monitor-issues', 'clear-context', token))).code).toBe(0);
        expect(JSON.parse(await readFile(harness.localFile, 'utf8'))).toEqual({ 'monitor-issues': { clear_context: value } });
      });
    }

    for (const token of ['ON', 'True', 'yes', '1']) {
      it(`refuses ${token} with exit 3 and the accepted tokens, writing nothing`, async () => {
        await harness.seed();

        const result = await harness.run(config('monitor-issues', 'clear-context', token));

        expect(result.code).toBe(3);
        expect(result.err).toBe(
          `arcanum: monitor-issues.clear_context must be on or off, got "${token}"\nhint: accepted: on, off, true, false (lowercase)\n`
        );
        expect(result.out).toBe('');
        await expectAsync(readFile(harness.localFile)).toBeRejected();
      });
    }

    it('lets a missing target win over a bad token', async () => {
      const result = await harness.run(config('monitor-issues', 'clear-context', 'yes'), { cwd: harness.account });

      expect(result.code).toBe(4);
    });
  });

  describe('usage errors (exit 2)', () => {
    const refused = [
      ['--unset with a value', ['engine', 'native', '--unset'], 'arcanum: engine: --unset cannot be combined with a value'],
      ['--force', ['engine', 'native', '--force'], 'arcanum: --force is not accepted by shortcuts (engine)'],
      ['--force on a read', ['git', 'merge-body', '--force'], 'arcanum: --force is not accepted by shortcuts (git merge-body)'],
      ['--string', ['git', 'safe-branch', 'x', '--string'], 'arcanum: --string is not accepted by shortcuts (git safe-branch)'],
      ['--all-tiers on a write', ['engine', 'native', '--all-tiers'], 'arcanum: --all-tiers is only accepted when reading'],
      ['--lock-timeout on a read', ['engine', '--lock-timeout', '1'], 'arcanum: --lock-timeout is only accepted when writing'],
      ['two tier flags', ['engine', 'native', '--local', '--global'], 'cannot be combined'],
      ['--all-tiers with a tier flag', ['engine', '--all-tiers', '--repo'], 'cannot be combined'],
      ['an extra value', ['engine', 'native', 'shell'], 'arcanum: engine: unexpected argument \'shell\''],
      ['a namespace with no shortcut', ['git'], 'arcanum: config git needs a shortcut: safe-branch, merge-body'],
      ['an unknown shortcut', ['git', 'nope'], 'arcanum: unknown config shortcut \'git nope\''],
      ['--unset on a generic subcommand', ['get', 'engine.mode', '--unset'], 'arcanum: --unset is only accepted by the shortcuts, not get']
    ];

    for (const [label, args, message] of refused) {
      it(`refuses ${label}`, async () => {
        await harness.seed();

        const result = await harness.run(config(...args));

        expect(result.code).toBe(2);
        expect(result.err).toContain(message);
        expect(result.out).toBe('');
      });
    }

    it('reports a JSON error object under --json', async () => {
      await harness.seed();

      const result = await harness.run(config('engine', 'native', '--unset', '--json'));

      expect(JSON.parse(result.err).error).toEqual(jasmine.objectContaining({ code: 'usage', exit: 2 }));
    });
  });

  describe('shadowed tiers', () => {
    it('notes the higher tier still overriding the write, on top of the generic output', async () => {
      const tiers = { local: { engine: { mode: 'docker' } } };
      const { shortcut: a, generic: b } = await harness.both(
        config('engine', 'native', '--repo'), config('set', 'engine.mode', 'native', '--repo'), tiers
      );

      expect(a.code).toBe(b.code);
      expect(a.out).toBe(b.out);
      expect(a.err).toBe(`${b.err}arcanum: note: local still overrides engine.mode (value: docker)\n`);
    });

    it('names the nearest overriding tier', async () => {
      await harness.seed({ local: { engine: { mode: 'docker' } }, repo: { engine: { mode: 'shell' } } });

      const result = await harness.run(config('engine', 'native', '--global', '--json'));

      expect(result.code).toBe(0);
      expect(result.err).toBe('arcanum: note: local still overrides engine.mode (value: docker)\n');
      expect(result.json().tier).toBe('global');
    });

    it('prints no note when nothing overrides the write', async () => {
      await harness.seed({ global: { engine: { mode: 'docker' } } });

      expect((await harness.run(config('engine', 'native', '--repo'))).err).toBe('');
    });

    it('skips a malformed higher tier silently', async () => {
      await harness.seed();
      await writeTier(harness.localFile, '{nope');

      const result = await harness.run(config('engine', 'native', '--repo'));

      expect(result.code).toBe(0);
      expect(result.err).toBe('');
    });

    it('prints no note outside a repo', async () => {
      const result = await harness.run(config('git', 'merge-body', 'full', '--global'), { cwd: path.dirname(harness.account) });

      expect(result.code).toBe(0);
      expect(result.err).toBe('');
    });
  });
});
