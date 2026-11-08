import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeTier } from '../../../../support/fixtures.js';
import { EOF, SIGINT, scriptedPrompter } from '../../../../support/prompter.js';
import { shortcutHarness } from '../../../../support/shortcuts.js';

describe('config shortcuts: agents email edit', () => {
  const harness = shortcutHarness();
  const git = (section) => ({ git: section });
  const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
  const addAgents = async (...names) => {
    const dir = path.join(harness.root, '.claude', 'agents');

    await mkdir(dir, { recursive: true });

    for (const name of names) {
      await writeFile(path.join(dir, `${name}.md`), '# agent\n');
    }
  };

  /**
   * Runs `config agents email edit` as if on a terminal.
   * @param {Array} answers - the scripted answers.
   * @param {object} [options] - `runCli` overrides, plus `args`.
   * @param {string[]} [options.args] - extra arguments after `edit`.
   * @returns {Promise<object>} the outcome, with the prompter.
   */
  async function edit(answers, options = {}) {
    const { args = [], ...rest } = options;
    const prompter = scriptedPrompter(answers);
    const outcome = await harness.run(['config', 'agents', 'email', 'edit', ...args], {
      ...rest,
      deps: { ...harness.deps, isInteractive: true, prompter }
    });

    return { ...outcome, prompter };
  }

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  describe('the loop', () => {
    it('shows the matrix, offers the listed agents and default, and finishes on an empty answer', async () => {
      await harness.seed({ global: git({ agents: { mod: 'mod@x.com' } }) });
      await addAgents('node');

      const { code, err, out, prompter } = await edit(['']);

      expect(code).toBe(0);
      expect(out).toBe('');
      expect(err).toContain('agent      local  repo  global');
      expect(err).toContain('mod        -      -     mod@x.com   (not in this repo) <- global');
      expect(prompter.questions).toEqual(['agent [mod/node/default] (Enter to finish): ']);
      expect(prompter.closed()).toBeTrue();
    });

    it('offers only default when there are no agents', async () => {
      await harness.seed();

      const { prompter } = await edit(['']);

      expect(prompter.questions).toEqual(['agent [default] (Enter to finish): ']);
    });

    it('sets an agent email at the default tier (global), then re-renders the matrix', async () => {
      await harness.seed();
      await addAgents('node');

      const { code, err, prompter } = await edit(['node', 'node@x.com', '', '', '']);

      expect(code).toBe(0);
      expect(prompter.questions).toEqual([
        'agent [node/default] (Enter to finish): ',
        '  email (- unsets): ',
        '  tier [local/repo/global] (global): ',
        `  write git.agents.node = node@x.com to global (${harness.globalFile})? [Y/n] `,
        'agent [node/default] (Enter to finish): '
      ]);
      expect(await readJson(harness.globalFile)).toEqual(git({ agents: { node: 'node@x.com' } }));
      expect(err).toContain('node       -      -     node@x.com   <- global');
    });

    for (const tier of ['local', 'repo', 'global']) {
      it(`sets and unsets at the ${tier} tier`, async () => {
        await harness.seed();
        await addAgents('node');

        await edit(['node', 'n@x.com', tier, 'y', '']);

        const file = { local: harness.localFile, repo: harness.repoFile, global: harness.globalFile }[tier];

        expect((await readJson(file)).git).toEqual({ agents: { node: 'n@x.com' } });

        const { prompter } = await edit(['node', '-', tier, '', '']);

        expect(prompter.questions[3]).toBe(`  unset git.agents.node at ${tier} (${file})? [Y/n] `);
        expect((await readJson(file)).git).toEqual({ agents: {} });
      });
    }

    it('writes git.email for the default row, storing the email as typed', async () => {
      await harness.seed();

      await edit(['default', 'you+{agent}@x.com', 'repo', 'y', '']);

      expect((await readJson(harness.repoFile)).git).toEqual({ email: 'you+{agent}@x.com' });
    });

    it('notes a higher tier still overriding the write', async () => {
      await harness.seed({ local: git({ agents: { node: 'l@x.com' } }) });
      await addAgents('node');

      const { err } = await edit(['node', 'g@x.com', '', '', '']);

      expect(err).toContain('arcanum: note: local still overrides git.agents.node (value: l@x.com)');
    });

    it('rejects an unknown agent with a hint, then re-asks', async () => {
      await harness.seed();
      await addAgents('node');

      const { code, err, prompter } = await edit(['ghost', '']);

      expect(code).toBe(0);
      expect(err).toContain('arcanum: unknown agent \'ghost\': answer one of node, default\n' +
        'hint: use arcanum config agents email set <agent> <email> for other agents\n');
      expect(prompter.questions.length).toBe(2);
    });

    it('re-asks an empty email and an unknown tier', async () => {
      await harness.seed();

      const { err, prompter } = await edit(['default', '', 'e@x.com', 'nowhere', 'global', 'n', '']);

      expect(err).toContain('arcanum: type an email, or - to unset');
      expect(err).toContain('arcanum: tier must be one of local, repo, global');
      expect(prompter.questions.filter((question) => question.startsWith('  email')).length).toBe(2);
    });

    it('writes nothing when the confirmation is declined', async () => {
      await harness.seed();

      const { code, err } = await edit(['default', 'e@x.com', 'global', 'n', '']);

      expect(code).toBe(0);
      expect(err).toContain('  nothing written\n');
      await expectAsync(readFile(harness.globalFile, 'utf8')).toBeRejected();
    });

    it('offers only the global tier outside a repo, without asking', async () => {
      await writeTier(harness.globalFile, git({ agents: { mod: 'm@x.com' } }));

      const { code, err, prompter } = await edit(['mod', 'new@x.com', '', ''], { cwd: harness.account });

      expect(code).toBe(0);
      expect(err).toContain('(no target)');
      expect(prompter.questions).toEqual([
        'agent [mod/default] (Enter to finish): ',
        '  email (- unsets): ',
        `  write git.agents.mod = new@x.com to global (${harness.globalFile})? [Y/n] `,
        'agent [mod/default] (Enter to finish): '
      ]);
      expect(await readJson(harness.globalFile)).toEqual(git({ agents: { mod: 'new@x.com' } }));
    });

    it('prints the read warnings once, not per round', async () => {
      await writeTier(harness.globalFile, {});

      const { err } = await edit(['default', 'e@x.com', '', '', ''], { cwd: harness.account });

      expect(err.split('reading the global tier only').length).toBe(2);
    });

    it('reports a failed write and goes on', async () => {
      await harness.seed({ local: {} });
      await writeFile(harness.localFile, '{ nope');

      const { code, err, prompter } = await edit(['default', 'e@x.com', 'local', 'y', '']);

      expect(code).toBe(0);
      expect(err).toContain('refusing to overwrite it');
      expect(prompter.questions[prompter.questions.length - 1]).toBe('agent [default] (Enter to finish): ');
    });

    it('writes nothing when no tier has a target', async () => {
      const { code, err, prompter } = await edit(['default', 'e@x.com', ''], { cwd: harness.account, env: {} });

      expect(code).toBe(0);
      expect(err).toContain('arcanum: no tier to write to (no repo and no claude config dir); nothing written\n');
      expect(prompter.questions.length).toBe(3);
    });

    it('stops on a read error, closing the prompter', async () => {
      const file = path.join(harness.tmp, 'not-a-dir');

      await writeFile(file, '');

      const { code, prompter } = await edit([''], { env: { CLAUDE_CONFIG_DIR: file } });

      expect(code).not.toBe(0);
      expect(prompter.questions).toEqual([]);
      expect(prompter.closed()).toBeTrue();
    });

    for (const [label, stop] of [['Ctrl-C', SIGINT], ['Ctrl-D', EOF]]) {
      it(`ends on ${label} at a prompt (exit 130), keeping the confirmed writes`, async () => {
        await harness.seed();

        const { code, prompter } = await edit(['default', 'e@x.com', 'global', 'y', 'default', stop]);

        expect(code).toBe(130);
        expect(prompter.closed()).toBeTrue();
        expect(await readJson(harness.globalFile)).toEqual(git({ email: 'e@x.com' }));
      });
    }
  });

  describe('usage errors (exit 2)', () => {
    it('refuses to run without a terminal, pointing to set/unset', async () => {
      await harness.seed();

      const { code, out, err } = await harness.run(['config', 'agents', 'email', 'edit']);

      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err).toBe('arcanum: config agents email edit needs an interactive terminal\n' +
        'hint: use arcanum config agents email set/unset instead\n');
    });

    const refused = [
      ['--json', ['--json']],
      ['--all-tiers', ['--all-tiers']],
      ['--unset', ['--unset']],
      ['--force', ['--force']],
      ['--string', ['--string']],
      ['a tier flag', ['--repo']],
      ['an invalid --lock-timeout', ['--lock-timeout', 'soon']],
      ['a positional', ['node']]
    ];

    for (const [label, args] of refused) {
      it(`refuses ${label}`, async () => {
        await harness.seed();

        const { code, out, prompter } = await edit([''], { args });

        expect(code).toBe(2);
        expect(out).toBe('');
        expect(prompter.questions).toEqual([]);
      });
    }

    it('accepts a valid --lock-timeout', async () => {
      await harness.seed();

      expect((await edit(['default', 'e@x.com', '', '', ''], { args: ['--lock-timeout', '5'] })).code).toBe(0);
    });
  });
});
