import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { repoAgents } from '../../../../../lib/commands/config/shortcuts/agentsEmail.js';
import { AGENT_EMAIL_FIXTURES, MODEL_EMAIL } from '../../../../support/agentEmailFixtures.js';
import { writeTier } from '../../../../support/fixtures.js';
import { observable, shortcutHarness } from '../../../../support/shortcuts.js';

describe('config shortcuts: agents email', () => {
  const harness = shortcutHarness();
  const config = (...args) => ['config', ...args];
  const git = (section) => ({ git: section });
  const addAgents = async (...names) => {
    const dir = path.join(harness.root, '.claude', 'agents');

    await mkdir(dir, { recursive: true });

    for (const name of names) {
      await writeFile(path.join(dir, name), '# agent\n');
    }
  };
  const seedGit = (tiers) => harness.seed(Object.fromEntries(Object.entries(tiers).map(([tier, section]) => [tier, git(section)])));

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  describe('resolution (the AgentEmail shell/native parity table)', () => {
    for (const { description, agent, tiers, expected, resolved } of AGENT_EMAIL_FIXTURES) {
      const email = expected === MODEL_EMAIL ? null : expected;

      it(`resolves ${agent} like agent_email.sh when ${description}`, async () => {
        await seedGit(tiers);
        await addAgents(`${agent}.md`);

        const detail = await harness.run(config('agents', 'email', agent, '--json'));
        const listing = (await harness.run(config('agents', 'email', '--json'))).json();

        expect(detail.code).toBe(email === null ? 1 : 0);
        expect(detail.json().resolved).toEqual({
          email,
          source: resolved ? resolved.tier : null,
          key: resolved ? resolved.key : null
        });
        expect(listing.agents.find((row) => row.agent === agent)).toEqual({
          agent, email, source: resolved ? resolved.tier : null, key: resolved ? resolved.key : null, in_repo: true
        });
      });
    }
  });

  describe('the listing', () => {
    it('prints the default line and every agent, sorted, with the documented JSON', async () => {
      await seedGit({
        repo: { agents: { node: 'node-bot@example.com' } },
        global: { email: 'you+{agent}@example.com', agents: { reviewer: 'rev@example.com' } }
      });
      await addAgents('node.md', 'architect.md');

      const human = await harness.run(config('agents', 'email'));
      const json = await harness.run(config('agents', 'email', '--json'));

      expect(human.code).toBe(0);
      expect(human.out).toBe([
        'default  you+{agent}@example.com   (global: git.email)',
        '',
        'agent      effective email            from',
        'architect  you+architect@example.com  global git.email',
        'node       node-bot@example.com       repo   git.agents.node',
        'reviewer   rev@example.com            global git.agents.reviewer   (not in this repo)',
        ''
      ].join('\n'));
      expect(json.code).toBe(0);
      expect(json.json()).toEqual({
        default: { set: true, value: 'you+{agent}@example.com', source: 'global' },
        agents: [
          { agent: 'architect', email: 'you+architect@example.com', source: 'global', key: 'git.email', in_repo: true },
          { agent: 'node', email: 'node-bot@example.com', source: 'repo', key: 'git.agents.node', in_repo: true },
          { agent: 'reviewer', email: 'rev@example.com', source: 'global', key: 'git.agents.reviewer', in_repo: false }
        ]
      });
    });

    it('shows the model default, and an explicit "" with where it sits', async () => {
      await seedGit({ repo: { agents: { scripter: '' } } });
      await addAgents('scripter.md', 'node.md');

      const result = await harness.run(config('agents', 'email'));

      expect(result.out).toBe([
        'default  (unset)',
        '',
        'agent     effective email  from',
        'node      (model default)',
        'scripter  (model default)  (empty at repo: git.agents.scripter)',
        ''
      ].join('\n'));
    });

    it('exits 0 with only the default line when nothing is configured', async () => {
      await harness.seed();

      const result = await harness.run(config('agents', 'email'));
      const json = await harness.run(config('agents', 'email', '--json'));

      expect(result.code).toBe(0);
      expect(result.out).toBe('default  (unset)\n');
      expect(json.json()).toEqual({ default: { set: false, value: null, source: null }, agents: [] });
    });

    it('ignores non-.md entries of the agents folder', async () => {
      await harness.seed();
      await addAgents('node.md', 'README.txt', 'notes.md.bak');
      await mkdir(path.join(harness.root, '.claude', 'agents', 'dir.md'));

      expect((await harness.run(config('agents', 'email', '--json'))).json().agents.map((row) => row.agent)).toEqual(['node']);
    });

    it('lists only configured agents outside a repo, unmarked, with in_repo null', async () => {
      await writeTier(harness.globalFile, git({ email: 'g@example.com', agents: { node: 'n@example.com' } }));

      const result = await harness.run(config('agents', 'email', '--json'), { cwd: harness.account });
      const human = await harness.run(config('agents', 'email'), { cwd: harness.account });

      expect(result.code).toBe(0);
      expect(result.json()).toEqual({
        default: { set: true, value: 'g@example.com', source: 'global' },
        agents: [{ agent: 'node', email: 'n@example.com', source: 'global', key: 'git.agents.node', in_repo: null }]
      });
      expect(human.out).not.toContain('not in this repo');
    });

    it('never reads repo-like files from a non-repo cwd', async () => {
      const cwd = path.join(harness.tmp, 'plain');

      await writeTier(path.join(cwd, '.claude', 'state', 'arcanum-config.json'), git({ email: 'stray@example.com' }));

      expect((await harness.run(config('agents', 'email', '--json'), { cwd })).json().default.set).toBeFalse();
    });

    it('prints an empty generic email as ""', async () => {
      await seedGit({ local: { email: '' } });

      expect((await harness.run(config('agents', 'email'))).out).toBe('default  ""   (local: git.email)\n');
    });
  });

  describe('the detail', () => {
    it('prints the per-tier breakdown, marking the resolved and shadowed keys', async () => {
      await seedGit({ repo: { agents: { node: 'node-bot@example.com' } }, global: { email: 'you+{agent}@example.com' } });

      const result = await harness.run(config('agents', 'email', 'node'));

      expect(result.code).toBe(0);
      expect(result.out).toBe([
        'local   git.agents.node  -',
        '        git.email        -',
        'repo    git.agents.node  node-bot@example.com      <- resolved',
        '        git.email        -',
        'global  git.agents.node  -',
        '        git.email        you+{agent}@example.com   (shadowed)',
        ''
      ].join('\n'));
    });

    it('prints the documented JSON', async () => {
      await seedGit({ repo: { agents: { node: 'node-bot@example.com' } }, global: { email: 'you+{agent}@example.com' } });

      expect((await harness.run(config('agents', 'email', 'node', '--json'))).json()).toEqual({
        agent: 'node',
        resolved: { email: 'node-bot@example.com', source: 'repo', key: 'git.agents.node' },
        tiers: {
          local: { agents: { set: false, value: null }, email: { set: false, value: null }, file: harness.localFile },
          repo: { agents: { set: true, value: 'node-bot@example.com' }, email: { set: false, value: null }, file: harness.repoFile },
          global: { agents: { set: false, value: null }, email: { set: true, value: 'you+{agent}@example.com' }, file: harness.globalFile }
        }
      });
    });

    it('exits 1 with every resolved field null when nothing resolves', async () => {
      await harness.seed();

      const result = await harness.run(config('agents', 'email', 'node', '--json'));

      expect(result.code).toBe(1);
      expect(result.json().resolved).toEqual({ email: null, source: null, key: null });
    });

    it('marks an explicit "" as resolving to the model default, exiting 1', async () => {
      await seedGit({ local: { email: '' }, global: { agents: { node: 'n@example.com' } } });

      const result = await harness.run(config('agents', 'email', 'node'));

      expect(result.code).toBe(1);
      expect(result.out).toContain('git.email        ""              <- resolved (empty: model default)');
      expect(result.out).toContain('n@example.com   (shadowed)');
    });

    it('reports file: null for the tiers with no target outside a repo', async () => {
      await writeTier(harness.globalFile, git({ email: 'g@example.com' }));

      const result = await harness.run(config('agents', 'email', 'node', '--json'), { cwd: harness.account });
      const human = await harness.run(config('agents', 'email', 'node'), { cwd: harness.account });

      expect(result.code).toBe(0);
      expect(result.json().tiers.local.file).toBeNull();
      expect(result.json().tiers.repo.file).toBeNull();
      expect(result.json().resolved).toEqual({ email: 'g@example.com', source: 'global', key: 'git.email' });
      expect(human.out).toContain('(no target)');
    });
  });

  describe('writes', () => {
    const forms = [
      ['set <pattern>', ['set', 'you+{agent}@example.com'], ['set', 'git.email', 'you+{agent}@example.com']],
      ['set <agent> <email>', ['set', 'node', 'n@example.com'], ['set', 'git.agents.node', 'n@example.com']],
      ['unset', ['unset'], ['unset', 'git.email']],
      ['unset <agent>', ['unset', 'node'], ['unset', 'git.agents.node']]
    ];
    const seeded = { global: git({ email: 'old@example.com', agents: { node: 'old-node@example.com' } }) };

    for (const [label, shortcut, generic] of forms) {
      for (const json of [[], ['--json']]) {
        const mode = json.length ? ' (--json)' : '';

        it(`${label} matches the generic command at the global tier${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config('agents', 'email', ...shortcut, ...json), config(...generic, '--global', ...json), seeded
          );

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });

        it(`${label} honours a tier override${mode}`, async () => {
          const { shortcut: a, generic: b } = await harness.both(
            config('agents', 'email', ...shortcut, '--repo', ...json), config(...generic, '--repo', ...json), seeded
          );

          expect(a.code).toBe(0);
          expect(observable(a)).toEqual(observable(b));
        });
      }
    }

    it('stores the email as typed', async () => {
      await harness.seed();

      await harness.run(config('agents', 'email', 'set', 'node', 'true'));

      expect(JSON.parse(await readFile(harness.globalFile, 'utf8'))).toEqual(git({ agents: { node: 'true' } }));
    });

    it('notes a higher tier still overriding the write', async () => {
      await seedGit({ repo: { email: 'team@example.com' } });

      const result = await harness.run(config('agents', 'email', 'set', 'you@example.com'));

      expect(result.code).toBe(0);
      expect(result.err).toBe('arcanum: note: repo still overrides git.email (value: team@example.com)\n');
    });
  });

  describe('usage errors (exit 2)', () => {
    const refused = [
      ['set with no value', ['set']],
      ['set with three values', ['set', 'a', 'b', 'c']],
      ['unset with two agents', ['unset', 'a', 'b']],
      ['two agents to show', ['a', 'b']],
      ['an invalid agent name', ['a.b']],
      ['an empty agent to set', ['set', '', 'x@example.com']],
      ['--unset on the listing', ['--unset']],
      ['--unset on set', ['set', 'x@example.com', '--unset']],
      ['a tier flag on the listing', ['--global']],
      ['a tier flag on the detail', ['node', '--repo']],
      ['--all-tiers on the detail', ['node', '--all-tiers']],
      ['--force on set', ['set', 'x@example.com', '--force']],
      ['--string on set', ['set', 'x@example.com', '--string']],
      ['--lock-timeout on the listing', ['--lock-timeout', '1']]
    ];

    for (const [label, args] of refused) {
      it(`refuses ${label}`, async () => {
        await harness.seed();

        const result = await harness.run(config('agents', 'email', ...args));

        expect(result.code).toBe(2);
        expect(result.out).toBe('');
      });
    }

    it('refuses agents with no shortcut', async () => {
      expect((await harness.run(config('agents'))).err).toContain('config agents needs a shortcut: email');
    });
  });

  describe('repoAgents', () => {
    it('is empty without an agents folder', async () => {
      expect(await repoAgents(harness.root)).toEqual(new Set());
    });
  });
});
