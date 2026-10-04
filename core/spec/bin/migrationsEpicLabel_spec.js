import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

// Contract spec for the `1.2.0/001` and `1.2.0/002` repo migrations that
// provision the `Epic:fbca04` label (issue #689; released in 1.2.0).
// NOT a parity spec: the migration scripts have no native counterpart.
// Each script runs with cwd = a temp git repo whose `origin` is github.com-shaped, with the
// fake `gh` (spec/support/utils/fakeGhBin.js) first on `PATH` and its
// `FAKE_GH_CALL_LOG` recording every `gh` invocation — no network.

const MIGRATIONS_DIR = path.join(REPO_ROOT, 'arcanum', 'migrations', 'repos', '1.2.0');
const SCRIPT_001 = path.join(MIGRATIONS_DIR, '001.sh');
const SCRIPT_002 = path.join(MIGRATIONS_DIR, '002.sh');
const REPO_REF = 'darthjee/arcanum-github-fixture';
const CONFIG = '.claude/state/init-claude-config.json';

describe('1.2.0/ Epic label migrations', () => {
  let repo;
  let fakeGh;
  let callLog;

  beforeEach(async () => {
    repo = await createGitFixtureRepo();
    fakeGh = await createFakeGhBin();
    callLog = path.join(fakeGh.binDir, 'calls.log');
    await seedGithubLikeRepo(repo);
  });

  afterEach(async () => {
    await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
  });

  /**
   * Run a migration script in the fixture repo with the fake `gh`.
   * @param {string} script - the migration script's absolute path.
   * @param {string} subcommand - `config` or `run`.
   * @param {object} [ghVars] - `FAKE_GH_*` env overrides.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runMigration(script, subcommand, ghVars = {}) {
    const env = {
      ...process.env,
      PATH: `${fakeGh.binDir}:${process.env.PATH}`,
      FAKE_GH_CALL_LOG: callLog,
      ...ghVars
    };

    return runCommand([script, subcommand], repo.repoPath, env);
  }

  /**
   * @returns {Promise<string[]>} the recorded `gh` calls, one per entry.
   */
  async function ghCalls() {
    try {
      return (await readFile(callLog, 'utf8')).split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * @returns {string} the label-config path inside the fixture repo.
   */
  function configPath() {
    return path.join(repo.repoPath, CONFIG);
  }

  /**
   * @param {object[]} labels - the `{name, color}` entries to seed.
   * @returns {Promise<void>} resolves once written.
   */
  async function seedConfig(labels) {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), `${JSON.stringify({ labels })}\n`);
  }

  /**
   * @returns {Promise<object[]>} the label-config's `labels` array.
   */
  async function configLabels() {
    return JSON.parse(await readFile(configPath(), 'utf8')).labels;
  }

  [['001', SCRIPT_001], ['002', SCRIPT_002]].forEach(([id, script]) => {
    it(`${id}.sh config prints {"skippable": true}`, async () => {
      const result = await runMigration(script, 'config');

      expect(result).toEqual({ stdout: '{"skippable": true}\n', stderr: '', code: 0 });
    });
  });

  describe('001.sh run (GitHub label)', () => {
    it('creates the Epic label with color fbca04 when it is missing', async () => {
      const result = await runMigration(SCRIPT_001, 'run', { FAKE_GH_REPO_LABELS: 'Bug\nSplit' });

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(`Created 'Epic' label on ${REPO_REF}.\n`);
      expect(await ghCalls()).toEqual([
        `label list -R ${REPO_REF} --limit 1000 --json name -q .[].name`,
        `label create Epic -R ${REPO_REF} --color fbca04`
      ]);
    });

    ['Epic', 'epic'].forEach((existing) => {
      it(`leaves an existing '${existing}' label untouched`, async () => {
        const result = await runMigration(SCRIPT_001, 'run', { FAKE_GH_REPO_LABELS: `Bug\n${existing}` });

        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual(`'Epic' label already present on ${REPO_REF}.\n`);
        expect((await ghCalls()).filter((call) => !call.startsWith('label list'))).toEqual([]);
      });
    });

    it('is idempotent: a re-run after creation only lists labels', async () => {
      await runMigration(SCRIPT_001, 'run');
      const rerun = await runMigration(SCRIPT_001, 'run', { FAKE_GH_REPO_LABELS: 'Epic' });

      expect(rerun.stdout).toEqual(`'Epic' label already present on ${REPO_REF}.\n`);
      expect((await ghCalls()).filter((call) => call.startsWith('label create'))).toEqual([
        `label create Epic -R ${REPO_REF} --color fbca04`
      ]);
    });

    it('fails non-zero when the label creation fails', async () => {
      const result = await runMigration(SCRIPT_001, 'run', { FAKE_GH_LABEL_WRITE_FAIL: '1' });

      expect(result.code).not.toEqual(0);
      expect(result.stdout).toEqual('');
    });
  });

  describe('002.sh run (init-claude-config.json)', () => {
    it('skips when the config is missing, without creating it', async () => {
      const result = await runMigration(SCRIPT_002, 'run');

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(`No ${CONFIG}; skipping.\n`);
      await expectAsync(readFile(configPath(), 'utf8')).toBeRejected();
    });

    it('appends Epic:fbca04 when the config lacks it, and is idempotent', async () => {
      await seedConfig([{ name: 'Bug', color: 'b60205' }]);

      const first = await runMigration(SCRIPT_002, 'run');

      expect(first.code).toEqual(0);
      expect(first.stdout).toEqual(`Added 'Epic:fbca04' to ${CONFIG}.\n`);
      expect(await configLabels()).toEqual([
        { name: 'Bug', color: 'b60205' },
        { name: 'Epic', color: 'fbca04' }
      ]);

      const rerun = await runMigration(SCRIPT_002, 'run');

      expect(rerun.stdout).toEqual(`'Epic' already present in ${CONFIG}.\n`);
      expect((await configLabels()).length).toEqual(2);
    });

    it('leaves an existing (case-insensitive) Epic entry unchanged', async () => {
      const labels = [{ name: 'epic', color: '123456' }];

      await seedConfig(labels);

      const result = await runMigration(SCRIPT_002, 'run');

      expect(result.code).toEqual(0);
      expect(result.stdout).toEqual(`'Epic' already present in ${CONFIG}.\n`);
      expect(await configLabels()).toEqual(labels);
    });
  });
});
