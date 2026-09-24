import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setupParityTest } from '../support/factories/githubParitySetup.js';
import { expectParity, FAKE_FETCH_PRELOAD, NATIVE_BIN, REPO_ROOT, runCommand } from '../support/utils/runCommand.js';

// Parity test for the "init-claude-sync-labels" migrated entrypoint
// (issue #594) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract". Runs init-claude/scripts/sync_labels_shell.sh
// directly (NOT through the sync_labels.sh engine_dispatch shim) against
// a fake `gh`, and `core/bin/arcanum init-claude-sync-labels` with the
// fake-fetch preload in `labels` mode, against two github-shaped fixture
// repos seeded identically, feeding the same stdin to both. Asserts
// identical stdout and exit code, plus identical stderr and config files
// wherever neither side involves `gh`.

const SHELL_SCRIPT = path.join(REPO_ROOT, 'init-claude', 'scripts', 'sync_labels_shell.sh');
const CONFIG = path.join('.claude', 'state', 'init-claude-config.json');
const TWO_LABELS = '{"labels":[{"name":"Bug","color":"b60205"},{"name":"Ready for Work","color":"ffaa04"}]}';

describe('init-claude-sync-labels parity (shell vs. native)', () => {
  let setup;

  /**
   * @param {object} opts - the scenario.
   * @param {string} opts.input - stdin fed to both sides.
   * @param {string} [opts.config] - the config seeded on both sides
   *   (none when omitted).
   * @param {string} [opts.repoLabels] - newline-separated existing repo
   *   labels.
   * @param {boolean} [opts.writeFail] - whether every label
   *   create/update fails.
   * @returns {Promise<{shell: object, native: object}>} both sides' results.
   */
  async function runBoth({ input, config = undefined, repoLabels = '', writeFail = false }) {
    setup = await setupParityTest();

    const { shellRepo, nativeRepo } = setup;
    const shellConfig = path.join(shellRepo.repoPath, CONFIG);
    const nativeConfig = path.join(nativeRepo.repoPath, CONFIG);

    if (config !== undefined) {
      for (const file of [shellConfig, nativeConfig]) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, config);
      }
    }

    const shell = await runCommand(
      [SHELL_SCRIPT, shellRepo.repoPath, shellConfig],
      shellRepo.repoPath,
      { ...setup.shellEnv, FAKE_GH_REPO_LABELS: repoLabels, FAKE_GH_LABEL_WRITE_FAIL: writeFail ? '1' : '' },
      input
    );
    const native = await runCommand(
      [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, 'init-claude-sync-labels', nativeRepo.repoPath, nativeConfig],
      nativeRepo.repoPath,
      {
        ...setup.nativeEnv,
        ARCANUM_TEST_FAKE_FETCH: 'labels',
        FAKE_FETCH_REPO_LABELS: repoLabels,
        FAKE_FETCH_LABEL_WRITE_FAIL: writeFail ? '1' : ''
      },
      input
    );

    shell.config = await readFile(shellConfig, 'utf8').catch(() => null);
    native.config = await readFile(nativeConfig, 'utf8').catch(() => null);

    return { shell, native };
  }

  /**
   * @param {{shell: object, native: object}} results - both sides' results.
   * @returns {void}
   */
  function expectFullParity({ shell, native }) {
    expectParity(shell, native);
    expect(native.stderr).toEqual(shell.stderr);
    expect(native.config).toEqual(shell.config);
  }

  afterEach(async () => {
    if (setup) {
      await setup.cleanup();
      setup = undefined;
    }
  });

  it('syncs on "y", updating case-insensitive matches and creating the rest', async () => {
    const results = await runBoth({ input: 'y\n', config: TWO_LABELS, repoLabels: 'bug\nOther' });

    expectParity(results.shell, results.native);
    expect(results.shell.code).withContext(results.shell.stderr).toEqual(0);
    expect(results.shell.stdout).toMatch(/STATUS=synced\nUPDATED=Bug\nCREATED=Ready for Work\n$/);
  });

  it('prints STATUS=discuss and exits 1 on "n"', async () => {
    const results = await runBoth({ input: 'n\n', config: TWO_LABELS });

    expectFullParity(results);
    expect(results.shell.code).toEqual(1);
    expect(results.shell.stdout).toMatch(/\[y\/n\]: STATUS=discuss\n$/);
  });

  it('fails with exit 2 on EOF', async () => {
    const results = await runBoth({ input: '', config: TWO_LABELS });

    expectFullParity(results);
    expect(results.shell.code).toEqual(2);
    expect(results.shell.stderr).toEqual('Error: no input available for confirmation prompt\n');
  });

  it('treats an unterminated final line as EOF', async () => {
    const results = await runBoth({ input: 'maybe\ny', config: TWO_LABELS });

    expectFullParity(results);
    expect(results.shell.code).toEqual(2);
  });

  it('re-prompts on invalid answers, then syncs on a padded " YES "', async () => {
    const results = await runBoth({ input: 'maybe\n\n \tYES \n', config: TWO_LABELS });

    expectParity(results.shell, results.native);
    expect(results.shell.code).toEqual(0);
    expect(results.shell.stdout.split('Sync these labels').length).toEqual(4);
  });

  it('fails with the usage block and exit 2 on an invalid config pair', async () => {
    const results = await runBoth({ input: 'y\n', config: '{"labels":[{"name":"Bug","color":"nothex"}]}' });

    expectFullParity(results);
    expect(results.shell.code).toEqual(2);
    expect(results.shell.stdout).toEqual('');
    expect(results.shell.stderr).toContain('Usage: sync_labels.sh <repo_path> [<config_path>]\n');
  });

  it('writes the defaults for a missing config before prompting', async () => {
    const results = await runBoth({ input: 'n\n' });

    expectFullParity(results);
    expect(results.shell.code).toEqual(1);
    expect(JSON.parse(results.shell.config).labels.length).toEqual(22);
  });

  it('fails non-zero after STATUS=synced when a label write fails', async () => {
    const results = await runBoth({ input: 'y\n', config: TWO_LABELS, writeFail: true });

    expect(results.native.stdout).toEqual(results.shell.stdout);
    expect(results.shell.code).not.toEqual(0);
    expect(results.native.code).not.toEqual(0);
    expect(results.shell.stdout).toMatch(/STATUS=synced\n$/);
  });
});
