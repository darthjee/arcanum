import { readFile } from 'node:fs/promises';
import path from 'node:path';
import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { needsRepo, selectSections, setupItems } from '../../../../lib/commands/config/setup.js';
import { defaultTier } from '../../../../lib/commands/config/shortcuts/defaultTier.js';
import { UsageError } from '../../../../lib/exitCodes.js';
import { run } from '../../../../lib/main.js';
import { fakeIo } from '../../../support/fakeIo.js';
import { makeRepo, writeTier } from '../../../support/fixtures.js';
import { EOF, SIGINT, scriptedPrompter } from '../../../support/prompter.js';
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
      const entry = (key, order) => ({
        key, type: 'string', tiers: ['global'], description: key, setup: { section: 'git', order, prompt: key }
      });
      const fake = new KeyRegistry({
        format_version: 1,
        keys: [entry('b.b', 2), entry('a.a', 1), { key: 'c.c', type: 'string', tiers: ['global'], description: 'c' }]
      });

      expect(setupItems(fake, ['git']).map(({ key }) => key)).toEqual(['a.a', 'b.b']);
    });
  });

  describe('default tiers', () => {
    const tierOf = (key) => defaultTier(key);

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
      const fake = new KeyRegistry({
        format_version: 1,
        keys: [
          { key: 'x.local', type: 'string', tiers: ['global', 'local'], description: 'x' },
          { key: 'x.global', type: 'string', tiers: ['global', 'repo'], description: 'x' }
        ]
      });

      expect(defaultTier('x.local', fake)).toBe('local');
      expect(defaultTier('x.global', fake)).toBe('global');
    });

    it('knows the registry key patterns', () => {
      expect(tierOf('git.agents.<agent>')).toBe('global');
      expect(tierOf('nope.nope')).toBeNull();
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

  describe('the per-setting flow', () => {
    /**
     * @param {string} file - a tier file.
     * @returns {Promise<(object|null)>} its content, `null` when absent.
     */
    async function tier(file) {
      try {
        return JSON.parse(await readFile(file, 'utf8'));
      } catch {
        return null;
      }
    }

    it('shows the setting and keeps the current value on Enter, asking nothing more', async () => {
      await harness.seed({ repo: { engine: { mode: 'native' } } });
      const { code, out, err, prompter } = await wizard(['engine'], ['']);

      expect(code).toBe(0);
      expect(out).toBe('');
      expect(err).toContain('engine.mode — Script engine used to run migrated skill entrypoints\n  current: native (repo)\n');
      expect(prompter.questions).toEqual(['  new value [shell/native/docker, Enter keeps, - unsets]: ']);
      expect(await tier(harness.localFile)).toBeNull();
    });

    it('shows an unset key with its registry default', async () => {
      await harness.seed();
      const { err } = await wizard(['engine'], ['']);

      expect(err).toContain('  current: (unset; default: shell)\n');
    });

    it('sets a value at the default tier after confirming', async () => {
      await harness.seed();
      const { code, prompter } = await wizard(['engine'], ['shell', '', '']);

      expect(code).toBe(0);
      expect(prompter.questions).toEqual([
        '  new value [shell/native/docker, Enter keeps, - unsets]: ',
        '  tier [local/repo/global] (local): ',
        `  set engine.mode = "shell" at local (${harness.localFile})? [Y/n] `
      ]);
      expect(await tier(harness.localFile)).toEqual({ engine: { mode: 'shell' } });
    });

    it('unsets the key at the chosen tier with -', async () => {
      await harness.seed({ local: { engine: { mode: 'docker' } } });
      const { code, prompter } = await wizard(['engine'], ['-', '', 'y']);

      expect(code).toBe(0);
      expect(prompter.questions[2]).toBe(`  unset engine.mode at local (${harness.localFile})? [Y/n] `);
      expect(await tier(harness.localFile)).toEqual({ engine: {} });
    });

    it('re-asks after an invalid enum value, printing the error', async () => {
      await harness.seed();
      const { code, err, prompter } = await wizard(['engine'], ['bogus', 'docker', '', '']);

      expect(code).toBe(0);
      expect(err).toContain('arcanum: engine.mode must be one of shell, native, docker, got "bogus"\n');
      expect(prompter.questions.slice(0, 2)).toEqual([
        '  new value [shell/native/docker, Enter keeps, - unsets]: ',
        '  new value [shell/native/docker, Enter keeps, - unsets]: '
      ]);
      expect(await tier(harness.localFile)).toEqual({ engine: { mode: 'docker' } });
    });

    it('stores booleans as JSON booleans, re-asking after an invalid token', async () => {
      await harness.seed();
      const { code, err } = await wizard(['flow'], ['maybe', 'y', '', '', 'off', '', '', '']);

      expect(code).toBe(0);
      expect(err).toContain('arcanum: next_step.auto.enhance-issue must be y or n, got "maybe"\n');
      expect(err).toContain('hint: accepted: y, n, on, off, true, false (lowercase)\n');
      expect(await tier(harness.localFile)).toEqual({
        next_step: { auto: { 'enhance-issue': true, 'discuss-issue': false } }
      });
    });

    it('writes to a non-default tier, re-asking after an invalid one', async () => {
      await harness.seed();
      const { err, prompter } = await wizard(['engine'], ['native', 'nowhere', 'global', '']);

      expect(err).toContain('arcanum: tier must be one of local, repo, global\n');
      expect(prompter.questions[3]).toBe(`  set engine.mode = "native" at global (${harness.globalFile})? [Y/n] `);
      expect(await tier(harness.globalFile)).toEqual({ engine: { mode: 'native' } });
    });

    it('skips the tier question for a single-tier key', async () => {
      await harness.seed();
      const { prompter } = await wizard(['git'], ['origin/dev', '', '']);

      expect(prompter.questions.slice(0, 2)).toEqual([
        '  new value [Enter keeps, - unsets]: ',
        `  set git.safe_branch = "origin/dev" at local (${harness.localFile})? [Y/n] `
      ]);
      expect(await tier(harness.localFile)).toEqual({ git: { safe_branch: 'origin/dev' } });
    });

    it('notes a higher-precedence tier that still overrides the chosen one', async () => {
      await harness.seed({ local: { engine: { mode: 'native' } } });
      const { err } = await wizard(['engine'], ['docker', 'global', '']);

      expect(err).toContain('arcanum: note: local still overrides this (value: native)\n');
      expect(await tier(harness.globalFile)).toEqual({ engine: { mode: 'docker' } });
    });

    it('writes nothing when the change is declined, re-asking an unclear answer', async () => {
      await harness.seed();
      const { code, err } = await wizard(['engine'], ['shell', '', 'maybe', 'n']);

      expect(code).toBe(0);
      expect(err).toContain('arcanum: answer y or n\n');
      expect(await tier(harness.localFile)).toBeNull();
    });

    it('forwards --lock-timeout to the write', async () => {
      await harness.seed();
      await new Lock().acquire(`${harness.localFile}.lock`);
      const { code, err } = await wizard(['engine', '--lock-timeout', '0'], ['shell', '', '']);

      expect(code).toBe(6);
      expect(err).toContain(`arcanum: timed out after 0s waiting for ${harness.localFile}.lock\n`);
    });
  });

  describe('the identity section', () => {
    beforeEach(async () => {
      await harness.seed({ global: { git: { email: 'bot+{agent}@example.com' } } });
    });

    /**
     * @param {string[]} agents - the agent names to create.
     * @returns {Promise<void>} resolves once written.
     */
    async function addAgents(agents) {
      for (const agent of agents) {
        await writeTier(path.join(harness.root, '.claude', 'agents', `${agent}.md`), `# ${agent}\n`);
      }
    }

    it('asks git.email, then skips the per-agent emails by default', async () => {
      await addAgents(['node']);
      const { code, prompter } = await wizard(['identity'], ['', '']);

      expect(code).toBe(0);
      expect(prompter.questions).toEqual(['  new value [Enter keeps, - unsets]: ', 'customise per-agent emails? [y/N] ']);
    });

    it('on yes, asks once per repo agent, sorted, showing what each resolves to', async () => {
      await addAgents(['node', 'client']);
      await writeTier(path.join(harness.root, '.claude', 'agents', 'notes.txt'), 'ignored');
      const { code, err, prompter } = await wizard(['identity'], ['', 'y', 'client@x.io', '', '', '']);

      expect(code).toBe(0);
      expect(err).toContain('git.agents.client — Commit email for one specific agent\n  current: (unset)\n' +
        '  currently resolves to: bot+client@example.com (git.email, global)\n');
      expect(err).toContain('git.agents.node — ');
      expect(prompter.questions[4]).toBe(`  set git.agents.client = "client@x.io" at global (${harness.globalFile})? [Y/n] `);
      expect(prompter.questions.length).toBe(6);
      expect(JSON.parse(await readFile(harness.globalFile, 'utf8'))).toEqual({
        git: { email: 'bot+{agent}@example.com', agents: { client: 'client@x.io' } }
      });
    });

    it('shows the model default when nothing resolves', async () => {
      await harness.seed();
      await addAgents(['node']);
      const { err } = await wizard(['identity'], ['', 'y', '']);

      expect(err).toContain('  currently resolves to: the model default\n');
    });

    it('skips the per-agent emails with a note when the repo has no agents', async () => {
      const { code, err, prompter } = await wizard(['identity'], ['']);

      expect(code).toBe(0);
      expect(err).toContain(`arcanum: note: no agents in ${harness.root}/.claude/agents; skipping the per-agent emails\n`);
      expect(prompter.questions.length).toBe(1);
    });
  });

  describe('the ci section', () => {
    const KEY = 'auto-fix-all.ignored_check_patterns';
    const stored = async () => JSON.parse(await readFile(harness.repoFile, 'utf8'))['auto-fix-all'];

    it('adds and removes patterns, one confirmed write each', async () => {
      await harness.seed({ repo: { 'auto-fix-all': { ignored_check_patterns: ['^sonar'] } } });
      const { code, err, prompter } = await wizard(['ci'], [
        'a', '[bad', '^codacy', '',
        'a', '^sonar',
        'r', '^nope',
        'r', '^sonar', '',
        'x', 'd'
      ]);

      expect(code).toBe(0);
      expect(err).toContain(`${KEY} — Case-insensitive regexes of CI checks to ignore\n  current: ^sonar\n`);
      expect(err).toMatch(/arcanum: auto-fix-all\.ignored_check_patterns\[0\] is not a valid regex: /);
      expect(err).toContain('  \'^sonar\' already present\n');
      expect(err).toContain('  \'^nope\' not present\n');
      expect(err).toContain('arcanum: answer a, r or d\n');
      expect(err).toContain('  now: ^sonar, ^codacy\n');
      expect(err).toContain('  now: ^codacy\n');
      expect(prompter.questions).toContain(`  add '^codacy' to ${KEY} at repo (${harness.repoFile})? [Y/n] `);
      expect(prompter.questions).toContain(`  remove '^sonar' from ${KEY} at repo (${harness.repoFile})? [Y/n] `);
      expect(await stored()).toEqual({ ignored_check_patterns: ['^codacy'] });
    });

    it('writes nothing when a change is declined, or when done straight away', async () => {
      await harness.seed();
      const { code, err } = await wizard(['ci'], ['a', '^codacy', 'n', '']);

      expect(code).toBe(0);
      expect(err).toContain('  current: (none)\n');
      expect(await stored()).toBeUndefined();
    });

    it('marks a stored non-array value failed and moves on', async () => {
      await harness.seed({ repo: { 'auto-fix-all': { ignored_check_patterns: 'oops' } } });
      const { code, err, prompter } = await wizard(['ci'], []);

      expect(code).toBe(3);
      expect(err).toContain(`arcanum: ${KEY} is not an array (got "oops")\n`);
      expect(err).toContain(`hint: fix it with: arcanum config set ${KEY} '[...]' --repo\n`);
      expect(prompter.questions).toEqual([]);
    });
  });

  describe('interrupts, write errors and the summary', () => {
    it('prints the summary after a full run', async () => {
      await harness.seed({ repo: { git: { merge_body_mode: 'full' } } });
      const { code, err } = await wizard(['engine', 'git'], ['shell', '', '', '', '']);

      expect(code).toBe(0);
      expect(err.endsWith([
        '',
        'summary',
        '  written      engine.mode            local   (unset) -> shell',
        '  kept         git.safe_branch        -       (unset)',
        '  kept         git.merge_body_mode    repo    full',
        ''
      ].join('\n'))).toBeTrue();
    });

    it('stops on Ctrl-C at a prompt (exit 130), collapsing the wildcard items not reached', async () => {
      await harness.seed();
      const { code, err } = await wizard(['engine', 'flow', 'ci'], ['shell', '', '', SIGINT]);

      expect(code).toBe(130);
      expect(err.endsWith([
        '',
        'summary',
        '  written      engine.mode    local   (unset) -> shell',
        '  not reached  next_step.auto.*, auto-fix-all.ignored_check_patterns',
        ''
      ].join('\n'))).toBeTrue();
    });

    it('treats EOF like Ctrl-C, listing the instances not reached', async () => {
      await harness.seed();
      const { code, err } = await wizard(['flow'], ['on', '', '', EOF]);

      expect(code).toBe(130);
      expect(err.endsWith([
        '',
        'summary',
        '  written      next_step.auto.enhance-issue    local   (unset) -> true',
        '  not reached  next_step.auto.discuss-issue, next_step.auto.auto-plan-issue',
        ''
      ].join('\n'))).toBeTrue();
    });

    it('marks the per-agent item not reached as git.agents.*', async () => {
      await harness.seed();
      await writeTier(path.join(harness.root, '.claude', 'agents', 'node.md'), '# node\n');
      const { code, err } = await wizard(['identity'], ['', EOF]);

      expect(code).toBe(130);
      expect(err).toContain('  not reached  git.agents.*\n');
    });

    it('prints an empty summary when interrupted at the first question', async () => {
      await harness.seed();
      const { err } = await wizard(['engine'], [SIGINT]);

      expect(err.endsWith('\nsummary\n  not reached  engine.mode\n')).toBeTrue();
    });

    it('prints the summary once, before the exit, on Ctrl-C during a write', async () => {
      await harness.seed();
      const handlers = [];
      const order = [];
      const io = fakeIo({ stdin: [], tty: true });
      const stderrWrite = io.stderr.write;

      io.stderr.write = (text) => {
        order.push(text);
        stderrWrite(text);
      };

      const signals = {
        on: (signal, handler) => handlers.push(handler),
        off: (signal, handler) => handlers.splice(handlers.indexOf(handler), 1),
        exit: (code) => order.push(`exit ${code}`)
      };
      const lock = {
        async acquire() {
          handlers[handlers.length - 1]();
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw Object.assign(new Error('stuck'), { code: 'LOCK_TIMEOUT' });
        },
        async release() {}
      };
      const code = await run(['config', 'setup', 'engine'], {
        io,
        cwd: harness.root,
        env: harness.env,
        version: '2.4.0',
        migrationVersions: { repo: [], local: [], global: [] },
        deps: { ...harness.deps, prompter: scriptedPrompter(['shell', '', '']), signals, lock }
      });
      const exitAt = order.indexOf('exit 130');

      expect(code).toBe(6);
      expect(exitAt).toBeGreaterThan(0);
      expect(order[exitAt - 1]).toBe('\nsummary\n  not reached  engine.mode\n');
      expect(io.err().split('summary').length).toBe(2);
    });

    it('marks a lock timeout failed, continues, and exits 6', async () => {
      await harness.seed();
      await new Lock().acquire(`${harness.localFile}.lock`);
      const { code, err } = await wizard(['engine', 'git', '--lock-timeout', '0'], ['shell', '', '', '', 'full', 'global', '']);

      expect(code).toBe(6);
      expect(err).toContain('hint: if no arcanum process is running, remove that file\n');
      expect(err.endsWith([
        '',
        'summary',
        `  failed       engine.mode            local   timed out after 0s waiting for ${harness.localFile}.lock`,
        '  kept         git.safe_branch        -       (unset)',
        '  written      git.merge_body_mode    global  (unset) -> full',
        ''
      ].join('\n'))).toBeTrue();
      expect(JSON.parse(await readFile(harness.globalFile, 'utf8'))).toEqual({ git: { merge_body_mode: 'full' } });
    });

    it('exits with the first error\'s code when several writes fail', async () => {
      await harness.seed();
      await writeTier(harness.globalFile, '{ not json');
      await new Lock().acquire(`${harness.localFile}.lock`);
      const { code, err } = await wizard(['identity', 'engine', '--lock-timeout', '0'], ['a@b.c', '', '', 'shell', '', '']);

      expect(code).toBe(7);
      expect(err).toMatch(/\n {2}failed {7}git\.email {6}global {2}\S/);
      expect(err).toMatch(/\n {2}failed {7}engine\.mode {4}local {3}timed out/);
    });
  });
});
