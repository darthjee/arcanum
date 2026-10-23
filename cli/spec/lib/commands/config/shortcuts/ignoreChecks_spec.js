import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import Lock from '../../../../../../shared/lib/file/Lock.js';
import { applyPatterns } from '../../../../../lib/commands/config/shortcuts/ignoreChecks.js';
import { REPO_FILE, writeTier } from '../../../../support/fixtures.js';
import { shortcutHarness } from '../../../../support/shortcuts.js';

describe('config shortcuts: auto-fix-all ignore-checks', () => {
  const harness = shortcutHarness();
  const KEY = 'auto-fix-all.ignored_check_patterns';
  const HINT = `hint: fix it with: arcanum config set ${KEY} '[...]' --repo`;
  const checks = (...args) => ['config', 'auto-fix-all', 'ignore-checks', ...args];
  const seedPatterns = (patterns) => harness.seed({ repo: { 'auto-fix-all': { ignored_check_patterns: patterns } } });
  const stored = async () => JSON.parse(await readFile(harness.repoFile, 'utf8'));
  const storedPatterns = async () => (await stored())['auto-fix-all'].ignored_check_patterns;

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  describe('list', () => {
    it('prints one raw pattern per line', async () => {
      await seedPatterns(['^codacy', 'sonar.*']);

      for (const argv of [checks(), checks('list')]) {
        const result = await harness.run(argv);

        expect(result.code).toBe(0);
        expect(result.out).toBe('^codacy\nsonar.*\n');
      }
    });

    it('prints nothing and exits 0 for an absent key', async () => {
      await harness.seed();

      const result = await harness.run(checks());

      expect(result.code).toBe(0);
      expect(result.out).toBe('');
      expect(result.err).toBe('');
    });

    it('prints the JSON shape', async () => {
      await seedPatterns(['^codacy']);

      expect((await harness.run(checks('list', '--json'))).json()).toEqual({
        key: KEY, tier: 'repo', file: harness.repoFile, patterns: ['^codacy']
      });
    });

    it('refuses a value that is not an array (exit 3)', async () => {
      await seedPatterns('^codacy');

      const result = await harness.run(checks('list'));

      expect(result.code).toBe(3);
      expect(result.err).toBe(`arcanum: ${KEY} is not an array (got "^codacy")\n${HINT}\n`);
    });

    it('accepts --repo', async () => {
      await seedPatterns(['^codacy']);

      expect((await harness.run(checks('list', '--repo'))).out).toBe('^codacy\n');
    });

    for (const tier of ['local', 'global']) {
      it(`refuses --${tier} (exit 3)`, async () => {
        await seedPatterns(['^codacy']);

        const result = await harness.run(checks('list', `--${tier}`));

        expect(result.code).toBe(3);
        expect(result.err).toBe(`arcanum: ${KEY} is repo-only\n`);
      });
    }

    it('refuses an extra argument (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(checks('list', 'x'))).code).toBe(2);
    });
  });

  describe('add', () => {
    it('adds one pattern to an absent key', async () => {
      await harness.seed();

      const result = await harness.run(checks('add', '^codacy'));

      expect(result.code).toBe(0);
      expect(result.out).toBe(`added '^codacy' to ${KEY} (repo: ${REPO_FILE})\n`);
      expect(await storedPatterns()).toEqual(['^codacy']);
    });

    it('appends many in order, keeping the existing order', async () => {
      await seedPatterns(['^sonar']);

      expect((await harness.run(checks('add', 'b', 'a'))).code).toBe(0);
      expect(await storedPatterns()).toEqual(['^sonar', 'b', 'a']);
    });

    it('skips a pattern already present', async () => {
      await seedPatterns(['^sonar']);

      const result = await harness.run(checks('add', '^sonar', '^codacy'));

      expect(result.out).toBe(`'^sonar' already present\nadded '^codacy' to ${KEY} (repo: ${REPO_FILE})\n`);
      expect(await storedPatterns()).toEqual(['^sonar', '^codacy']);
    });

    it('matches by exact string: an equivalent regex spelled differently is added', async () => {
      await seedPatterns(['^sonar']);

      await harness.run(checks('add', '^SONAR'));

      expect(await storedPatterns()).toEqual(['^sonar', '^SONAR']);
    });

    it('is a no-op with changed: false when every pattern is present, leaving the bytes', async () => {
      await seedPatterns(['^sonar']);
      const before = await readFile(harness.repoFile, 'utf8');

      const result = await harness.run(checks('add', '^sonar', '--json'));

      expect(result.code).toBe(0);
      expect(result.json()).toEqual(jasmine.objectContaining({ changed: false, added: [], removed: [], value: ['^sonar'] }));
      expect(await readFile(harness.repoFile, 'utf8')).toBe(before);
    });

    it('prints the config set shape plus added and removed', async () => {
      await seedPatterns(['^sonar']);

      expect((await harness.run(checks('add', '^codacy', '--json'))).json()).toEqual({
        key: KEY, tier: 'repo', file: harness.repoFile,
        changed: true, previous: { set: true, value: ['^sonar'] }, value: ['^sonar', '^codacy'], forced: false,
        added: ['^codacy'], removed: []
      });
    });

    it('reports previous unset for an absent key', async () => {
      await harness.seed();

      expect((await harness.run(checks('add', 'x', '--json'))).json().previous).toEqual({ set: false, value: null });
    });

    it('accepts patterns starting with - after --', async () => {
      await harness.seed();

      expect((await harness.run(checks('add', '--', '-flaky', '--x'))).code).toBe(0);
      expect(await storedPatterns()).toEqual(['-flaky', '--x']);
    });

    it('parses a pattern starting with - without -- as an unknown flag (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(checks('add', '-flaky'))).code).toBe(2);
    });

    it('refuses an invalid regex in a multi-pattern call, writing nothing', async () => {
      await seedPatterns(['^sonar']);
      const before = await readFile(harness.repoFile, 'utf8');

      const result = await harness.run(checks('add', '^ok', '(', '^also-ok'));

      expect(result.code).toBe(3);
      expect(result.err).toBe(`arcanum: ${KEY}[1] is not a valid regex: Unterminated group\n`);
      expect(await readFile(harness.repoFile, 'utf8')).toBe(before);
    });

    it('refuses a value that is not an array (exit 3), writing nothing', async () => {
      await seedPatterns({ a: 1 });
      const before = await readFile(harness.repoFile, 'utf8');

      const result = await harness.run(checks('add', 'x'));

      expect(result.code).toBe(3);
      expect(result.err).toContain(HINT);
      expect(await readFile(harness.repoFile, 'utf8')).toBe(before);
    });

    it('needs a pattern (exit 2)', async () => {
      await harness.seed();

      const result = await harness.run(checks('add'));

      expect(result.code).toBe(2);
      expect(result.err).toContain('arcanum: auto-fix-all ignore-checks add needs <pattern>...');
    });

    for (const tier of ['local', 'global']) {
      it(`refuses --${tier} (exit 3), writing nothing`, async () => {
        await harness.seed();

        const result = await harness.run(checks('add', 'x', `--${tier}`));

        expect(result.code).toBe(3);
        expect(result.err).toBe(`arcanum: ${KEY} is repo-only\n`);
      });
    }

    it('refuses a malformed repo file (exit 7)', async () => {
      await writeTier(harness.repoFile, '{nope');

      expect((await harness.run(checks('add', 'x'))).code).toBe(7);
    });

    it('refuses a repo file ahead of the CLI (exit 5)', async () => {
      await writeTier(harness.repoFile, { version: '9.0.0' });

      expect((await harness.run(checks('add', 'x'))).code).toBe(5);
    });

    it('refuses outside a repo (exit 4)', async () => {
      expect((await harness.run(checks('add', '('), { cwd: harness.account })).code).toBe(4);
    });

    it('times out on a held lock (exit 6)', async () => {
      await harness.seed();
      await writeFile(`${harness.repoFile}.lock`, `${os.hostname()}:${process.pid}:held\n`);

      expect((await harness.run(checks('add', 'x', '--lock-timeout', '0'))).code).toBe(6);
    });

    it('keeps both patterns of two concurrent adds against a lock held beforehand', async () => {
      await seedPatterns(['^sonar']);
      const lockFile = `${harness.repoFile}.lock`;

      await writeFile(lockFile, `${os.hostname()}:${process.pid}:held\n`);

      const run = (pattern) => harness.run(checks('add', pattern, '--lock-timeout', '5'), {
        deps: { ...harness.deps, lock: new Lock({ sleepMs: 10 }) }
      });
      const first = run('^codacy');
      const second = run('^circleci');

      await sleep(100);
      await rm(lockFile);

      const results = await Promise.all([first, second]);

      expect(results.map((result) => result.code)).toEqual([0, 0]);
      expect((await storedPatterns()).sort()).toEqual(['^circleci', '^codacy', '^sonar']);
      expect((await storedPatterns())[0]).toBe('^sonar');
    });
  });

  describe('remove', () => {
    it('removes patterns by exact string', async () => {
      await seedPatterns(['a', 'b', 'c']);

      const result = await harness.run(checks('remove', 'c', 'a'));

      expect(result.code).toBe(0);
      expect(result.out).toBe(`removed 'c' from ${KEY} (repo: ${REPO_FILE})\nremoved 'a' from ${KEY} (repo: ${REPO_FILE})\n`);
      expect(await storedPatterns()).toEqual(['b']);
    });

    it('skips a missing pattern', async () => {
      await seedPatterns(['a']);

      const result = await harness.run(checks('remove', 'zzz', '--json'));

      expect(result.code).toBe(0);
      expect(result.json()).toEqual(jasmine.objectContaining({ changed: false, removed: [], value: ['a'] }));
      expect(result.json().previous).toEqual({ set: true, value: ['a'] });
    });

    it('prints a not-present line for a missing pattern', async () => {
      await seedPatterns(['a']);

      expect((await harness.run(checks('remove', 'zzz'))).out).toBe('\'zzz\' not present\n');
    });

    it('leaves [] after removing the last pattern', async () => {
      await seedPatterns(['a']);

      const result = await harness.run(checks('remove', 'a', '--json'));

      expect(result.json()).toEqual({
        key: KEY, tier: 'repo', file: harness.repoFile,
        changed: true, previous: { set: true, value: ['a'] }, value: [], forced: false, added: [], removed: ['a']
      });
      expect(await storedPatterns()).toEqual([]);
    });

    it('is a no-op on an absent key, writing nothing', async () => {
      await harness.seed();
      const before = await readFile(harness.repoFile, 'utf8');

      const result = await harness.run(checks('remove', 'a', '--json'));

      expect(result.code).toBe(0);
      expect(result.json()).toEqual(jasmine.objectContaining({
        changed: false, previous: { set: false, value: null }, value: [], removed: []
      }));
      expect(await readFile(harness.repoFile, 'utf8')).toBe(before);
    });

    it('removes a stale invalid regex without validating it', async () => {
      await seedPatterns(['(', 'ok']);

      expect((await harness.run(checks('remove', '('))).code).toBe(0);
      expect(await storedPatterns()).toEqual(['ok']);
    });

    it('refuses a value that is not an array (exit 3)', async () => {
      await seedPatterns('a');

      const result = await harness.run(checks('remove', 'a'));

      expect(result.code).toBe(3);
      expect(result.err).toContain(HINT);
    });

    it('needs a pattern (exit 2)', async () => {
      await harness.seed();

      expect((await harness.run(checks('remove'))).code).toBe(2);
    });

    it('refuses --local (exit 3)', async () => {
      await harness.seed();

      expect((await harness.run(checks('remove', 'a', '--local'))).code).toBe(3);
    });
  });

  describe('usage errors (exit 2)', () => {
    for (const [label, argv] of [
      ['an unknown verb', checks('clear')],
      ['--unset', checks('--unset')],
      ['--force', checks('add', 'x', '--force')],
      ['--string', checks('add', 'x', '--string')],
      ['--all-tiers on add', checks('add', 'x', '--all-tiers')],
      ['--lock-timeout on list', checks('list', '--lock-timeout', '1')]
    ]) {
      it(`refuses ${label}`, async () => {
        await harness.seed();

        expect((await harness.run(argv)).code).toBe(2);
      });
    }
  });

  describe('applyPatterns', () => {
    it('dedupes patterns repeated in one add', () => {
      expect(applyPatterns('add', [], ['a', 'a'])).toEqual({ value: ['a'], added: ['a'], removed: [] });
    });

    it('dedupes patterns repeated in one remove', () => {
      expect(applyPatterns('remove', ['a', 'b'], ['a', 'a'])).toEqual({ value: ['b'], added: [], removed: ['a'] });
    });
  });
});
