import path from 'node:path';
import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';
import {
  defaultTier, needsRepo, selectSections, setupItems
} from '../../../../lib/commands/config/setup.js';
import { UsageError } from '../../../../lib/exitCodes.js';
import { makeRepo } from '../../../support/fixtures.js';
import { scriptedPrompter } from '../../../support/prompter.js';
import { shortcutHarness } from '../../../support/shortcuts.js';

describe('config setup', () => {
  const harness = shortcutHarness();
  const registry = new KeyRegistry();

  /**
   * Runs `config setup` as if on a terminal, answering from a script.
   * @param {string[]} args - the arguments after `config setup`.
   * @param {Array} answers - the scripted answers.
   * @param {object} [options] - `runCli` overrides.
   * @returns {Promise<object>} the outcome, with the prompter.
   */
  async function wizard(args, answers = [], options = {}) {
    const prompter = scriptedPrompter(answers);
    const outcome = await harness.run(['config', 'setup', ...args], {
      ...options,
      deps: { ...harness.deps, isInteractive: true, prompter, ...(options.deps || {}) }
    });

    return { ...outcome, prompter };
  }

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  describe('the terminal requirement', () => {
    it('refuses to run without a terminal (exit 2)', async () => {
      const { code, out, err } = await harness.run(['config', 'setup']);

      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err).toBe('arcanum: config setup needs an interactive terminal\n' +
        'hint: use arcanum config set / the shortcuts instead\n');
    });

    it('refuses when only stdin is piped', async () => {
      const { code } = await harness.run(['config', 'setup'], { io: { stdin: ['x'] } });

      expect(code).toBe(2);
    });

    it('runs when stdin and stderr are terminals', async () => {
      const { code } = await harness.run(['config', 'setup', 'engine'], {
        io: { stdin: [], tty: true },
        deps: { ...harness.deps, prompter: scriptedPrompter(['']) }
      });

      expect(code).not.toBe(2);
    });

    it('refuses --json (exit 2)', async () => {
      const { code, err } = await wizard(['--json']);

      expect(code).toBe(2);
      expect(JSON.parse(err).error.message).toBe('arcanum: --json is not accepted by setup: it is interactive');
    });

    it('refuses a tier flag (exit 2)', async () => {
      const { code, err } = await wizard(['--local']);

      expect(code).toBe(2);
      expect(err).toContain('--local is not accepted by setup');
    });

    it('refuses an invalid --lock-timeout (exit 2)', async () => {
      const { code } = await wizard(['--lock-timeout', 'soon']);

      expect(code).toBe(2);
    });

    it('prints its usage with --help', async () => {
      const { code, out } = await harness.run(['config', 'setup', '--help']);

      expect(code).toBe(0);
      expect(out).toContain('Usage: arcanum config setup [<section>...]');
      expect(out).toContain('identity, engine, git, flow, ci');
    });
  });

  describe('sections', () => {
    it('refuses an unknown section, listing the valid ones (exit 2)', async () => {
      const { code, err } = await wizard(['identity', 'nope']);

      expect(code).toBe(2);
      expect(err).toBe('arcanum: unknown setup section \'nope\'\nhint: sections: identity, engine, git, flow, ci\n');
    });

    it('runs every section by default', () => {
      expect(selectSections([])).toEqual(['identity', 'engine', 'git', 'flow', 'ci']);
    });

    it('deduplicates and orders the sections canonically', () => {
      expect(selectSections(['flow', 'identity', 'flow'])).toEqual(['identity', 'flow']);
    });

    it('throws a usage error for an unknown section', () => {
      expect(() => selectSections(['nope'])).toThrowError(UsageError);
    });

    it('builds the items by section, then by order, expanding instances', () => {
      expect(setupItems(registry, selectSections([])).map(({ key, kind }) => [key, kind])).toEqual([
        ['git.email', 'value'],
        ['git.agents.<agent>', 'agents'],
        ['engine.mode', 'value'],
        ['git.safe_branch', 'value'],
        ['git.merge_body_mode', 'value'],
        ['next_step.auto.enhance-issue', 'value'],
        ['next_step.auto.discuss-issue', 'value'],
        ['next_step.auto.auto-plan-issue', 'value'],
        ['auto-fix-all.ignored_check_patterns', 'array']
      ]);
    });

    it('builds only the requested sections\' items', () => {
      expect(setupItems(registry, ['git']).map(({ key }) => key)).toEqual(['git.safe_branch', 'git.merge_body_mode']);
    });

    it('orders by setup.order within a section, whatever the registry order', () => {
      const entry = (key, order) => ({ key, type: 'string', tiers: ['global'], setup: { section: 'git', order, prompt: key } });
      const fake = { entries: () => [entry('b.b', 2), entry('a.a', 1), { key: 'c.c', type: 'string', tiers: ['global'] }] };

      expect(setupItems(fake, ['git']).map(({ key }) => key)).toEqual(['a.a', 'b.b']);
    });
  });

  describe('default tiers', () => {
    const tierOf = (key) => defaultTier(registry.lookup(key));

    it('uses the matching shortcut\'s default tier', () => {
      expect(tierOf('git.email')).toBe('global');
      expect(tierOf('git.agents.node')).toBe('global');
      expect(tierOf('engine.mode')).toBe('local');
      expect(tierOf('git.merge_body_mode')).toBe('local');
      expect(tierOf('next_step.auto.enhance-issue')).toBe('local');
    });

    it('uses a single-tier key\'s only tier', () => {
      expect(tierOf('git.safe_branch')).toBe('local');
      expect(tierOf('auto-fix-all.ignored_check_patterns')).toBe('repo');
    });

    it('falls back to local, then to the first tier, for a key with no shortcut', () => {
      expect(defaultTier({ key: 'x.y', tiers: ['global', 'local'] })).toBe('local');
      expect(defaultTier({ key: 'x.y', tiers: ['global', 'repo'] })).toBe('global');
    });

    it('marks the repo-dependent items', () => {
      const byKey = Object.fromEntries(setupItems(registry, selectSections([])).map((item) => [item.key, needsRepo(item)]));

      expect(byKey['git.email']).toBeFalse();
      expect(byKey['git.agents.<agent>']).toBeTrue();
      expect(byKey['engine.mode']).toBeTrue();
      expect(byKey['auto-fix-all.ignored_check_patterns']).toBeTrue();
    });
  });

  describe('targeting', () => {
    it('outside a repo, skips the repo-dependent items with one note per section', async () => {
      const { code, err } = await wizard([], [], { cwd: harness.tmp });
      const where = `no repo at ${harness.tmp}`;

      expect(code).not.toBe(4);
      expect(err).toContain(`arcanum: note: skipping git.agents.<agent> (identity): ${where}\n`);
      expect(err).toContain(`arcanum: note: skipping the engine section: ${where}\n`);
      expect(err).toContain(`arcanum: note: skipping the git section: ${where}\n`);
      expect(err).toContain(`arcanum: note: skipping the flow section: ${where}\n`);
      expect(err).toContain(`arcanum: note: skipping the ci section: ${where}\n`);
      expect(err).not.toContain('/init-claude');
    });

    it('in an unconfigured repo, skips the same items and hints at /init-claude', async () => {
      const root = await makeRepo(path.join(harness.tmp, 'bare'), { repoConfig: null });
      const { err } = await wizard(['identity', 'ci'], [], { cwd: root });

      expect(err).toContain(`arcanum: note: skipping the ci section: ${root} is not arcanum-configured`);
      expect(err).toContain(`arcanum: note: run /init-claude in ${root}\n`);
    });

    it('exits 4 after the notes when nothing is left to ask', async () => {
      const { code, err } = await wizard(['engine', 'ci'], [], { cwd: harness.tmp });

      expect(code).toBe(4);
      expect(err).toContain('arcanum: note: skipping the engine section');
      expect(err).toContain('arcanum: note: skipping the ci section');
      expect(err).toContain('arcanum: nothing to set up: every requested setting needs a configured repo');
    });

    it('carries the /init-claude hint when an unconfigured repo leaves nothing', async () => {
      const root = await makeRepo(path.join(harness.tmp, 'bare'), { repoConfig: null });
      const { code, err } = await wizard(['ci'], [], { cwd: root });

      expect(code).toBe(4);
      expect(err).toContain(`hint: run /init-claude in ${root}\n`);
    });

    it('keeps every item in a configured repo, with no note', async () => {
      const { err } = await wizard(['ci']);

      expect(err).not.toContain('note: skipping');
    });
  });
});
