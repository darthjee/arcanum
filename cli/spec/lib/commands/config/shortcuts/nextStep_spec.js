import { readFile } from 'node:fs/promises';
import { observable, shortcutHarness } from '../../../../support/shortcuts.js';

describe('config shortcuts: next-step auto', () => {
  const harness = shortcutHarness();
  const config = (...args) => ['config', ...args];
  const auto = (skills) => ({ next_step: { auto: skills } });

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  describe('the listing', () => {
    it('prints nothing and exits 0 when no skill is set', async () => {
      await harness.seed();

      const result = await harness.run(config('next-step', 'auto'));

      expect(result.code).toBe(0);
      expect(result.out).toBe('');
      expect(result.err).toBe('');
    });

    it('prints an empty entries list under --json', async () => {
      await harness.seed();

      const result = await harness.run(config('next-step', 'auto', '--json'));

      expect(result.code).toBe(0);
      expect(result.json()).toEqual({ entries: [] });
    });

    it('lists resolved values from mixed tiers, sorted by skill, aligned', async () => {
      await harness.seed({
        local: auto({ 'auto-plan-issue': false }),
        repo: auto({ 'discuss-issue': true }),
        global: auto({ 'enhance-issue': true })
      });

      const result = await harness.run(config('next-step', 'auto'));

      expect(result.code).toBe(0);
      expect(result.out).toBe([
        'auto-plan-issue  false  (local)',
        'discuss-issue    true   (repo)',
        'enhance-issue    true   (global)',
        ''
      ].join('\n'));
    });

    it('prints the JSON entries', async () => {
      await harness.seed({ local: auto({ 'auto-plan-issue': false }), global: auto({ 'enhance-issue': true }) });

      expect((await harness.run(config('next-step', 'auto', '--json'))).json()).toEqual({
        entries: [
          { key: 'next_step.auto.auto-plan-issue', value: false, source: 'local' },
          { key: 'next_step.auto.enhance-issue', value: true, source: 'global' }
        ]
      });
    });

    it('shows a false shadowing a true once, from the higher tier', async () => {
      await harness.seed({ local: auto({ 'enhance-issue': false }), global: auto({ 'enhance-issue': true }) });

      expect((await harness.run(config('next-step', 'auto'))).out).toBe('enhance-issue  false  (local)\n');
    });

    it('skips a null value, so a lower tier resolves', async () => {
      await harness.seed({ local: auto({ 'enhance-issue': null }), repo: auto({ 'enhance-issue': true }) });

      expect((await harness.run(config('next-step', 'auto'))).out).toBe('enhance-issue  true  (repo)\n');
    });

    it('ignores a next_step.auto that is not an object', async () => {
      await harness.seed({ local: { next_step: { auto: 'nope' } }, global: auto({ 'enhance-issue': true }) });

      expect((await harness.run(config('next-step', 'auto'))).out).toBe('enhance-issue  true  (global)\n');
    });

    it('reads only one tier with a tier flag', async () => {
      await harness.seed({ local: auto({ 'auto-plan-issue': false }), global: auto({ 'enhance-issue': true }) });

      expect((await harness.run(config('next-step', 'auto', '--global'))).out).toBe('enhance-issue  true  (global)\n');
    });

    it('lists the global tier only outside a repo, with the generic note', async () => {
      await harness.seed({ global: auto({ 'enhance-issue': true }) });

      const result = await harness.run(config('next-step', 'auto'), { cwd: harness.account });

      expect(result.code).toBe(0);
      expect(result.out).toBe('enhance-issue  true  (global)\n');
      expect(result.err).toContain('reading the global tier only');
    });

    for (const [label, args] of [
      ['--unset', ['--unset']],
      ['--all-tiers', ['--all-tiers']],
      ['--lock-timeout', ['--lock-timeout', '1']],
      ['--force', ['--force']]
    ]) {
      it(`refuses ${label} (exit 2)`, async () => {
        await harness.seed();

        expect((await harness.run(config('next-step', 'auto', ...args))).code).toBe(2);
      });
    }
  });

  describe('a skill', () => {
    const key = 'next_step.auto.enhance-issue';

    for (const json of [[], ['--json']]) {
      const mode = json.length ? ' (--json)' : '';

      it(`reads like config get${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', ...json), config('get', key, ...json), { global: auto({ 'enhance-issue': true }) }
        );

        expect(a.code).toBe(0);
        expect(observable(a)).toEqual(observable(b));
      });

      it(`reads an unset skill like config get, with its default${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', ...json), config('get', key, ...json)
        );

        expect(a.code).toBe(1);
        expect(observable(a)).toEqual(observable(b));
      });

      it(`reads every tier like config get --all-tiers${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', '--all-tiers', ...json), config('get', key, '--all-tiers', ...json),
          { local: auto({ 'enhance-issue': false }), global: auto({ 'enhance-issue': true }) }
        );

        expect(observable(a)).toEqual(observable(b));
      });

      it(`sets on like config set true --local${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', 'on', ...json), config('set', key, 'true', '--local', ...json)
        );

        expect(a.code).toBe(0);
        expect(observable(a)).toEqual(observable(b));
      });

      it(`sets off at a tier override like config set false --global${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', 'off', '--global', ...json), config('set', key, 'false', '--global', ...json)
        );

        expect(a.code).toBe(0);
        expect(observable(a)).toEqual(observable(b));
      });

      it(`unsets like config unset --local${mode}`, async () => {
        const { shortcut: a, generic: b } = await harness.both(
          config('next-step', 'auto', 'enhance-issue', '--unset', ...json), config('unset', key, '--local', ...json),
          { local: auto({ 'enhance-issue': true }) }
        );

        expect(a.code).toBe(0);
        expect(observable(a)).toEqual(observable(b));
      });
    }

    it('accepts any well-formed skill name and stores a JSON boolean', async () => {
      await harness.seed();

      expect((await harness.run(config('next-step', 'auto', 'no-such-skill', 'on'))).code).toBe(0);
      expect(JSON.parse(await readFile(harness.localFile, 'utf8'))).toEqual(auto({ 'no-such-skill': true }));
    });

    it('refuses an uppercase token (exit 3)', async () => {
      await harness.seed();

      const result = await harness.run(config('next-step', 'auto', 'enhance-issue', 'On'));

      expect(result.code).toBe(3);
      expect(result.err).toContain('hint: accepted: on, off, true, false (lowercase)');
    });

    it('notes a local value shadowing a global write', async () => {
      await harness.seed({ local: auto({ 'enhance-issue': false }) });

      const result = await harness.run(config('next-step', 'auto', 'enhance-issue', 'on', '--global'));

      expect(result.code).toBe(0);
      expect(result.err).toBe('arcanum: note: local still overrides next_step.auto.enhance-issue (value: false)\n');
    });

    it('refuses an empty skill name (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(config('next-step', 'auto', '', 'on'))).code).toBe(2);
    });

    it('refuses a value plus --unset (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(config('next-step', 'auto', 'enhance-issue', 'on', '--unset'))).code).toBe(2);
    });

    it('refuses an extra argument (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(config('next-step', 'auto', 'enhance-issue', 'on', 'off'))).code).toBe(2);
    });
  });

  it('refuses next-step with no shortcut (exit 2)', async () => {
    await harness.seed();

    const result = await harness.run(config('next-step'));

    expect(result.code).toBe(2);
    expect(result.err).toContain('config next-step needs a shortcut: auto');
  });
});
