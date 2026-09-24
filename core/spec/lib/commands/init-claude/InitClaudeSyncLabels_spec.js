import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import InitClaudeSyncLabels from '../../../../lib/commands/init-claude/InitClaudeSyncLabels.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { DEFAULT_LABEL_PAIRS } from '../../../../lib/services/LabelConfig.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import LineReader from '../../../../lib/utils/io/LineReader.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PROMPT = 'Sync these labels to GitHub? [y/n]: ';
const TABLE = '| Label | Color |\n| --- | --- |\n| Bug | #b60205 |\n| Ready for Work | #ffaa04 |\n';

describe('InitClaudeSyncLabels', () => {
  let dir;
  let configPath;
  let stdout;
  let stderr;
  let client;
  let factory;

  beforeEach(async () => {
    dir = await createTempDir();
    configPath = path.join(dir, 'labels.json');
    stdout = [];
    stderr = spyOn(process.stderr, 'write').and.returnValue(true);
    client = {
      listLabelNames: jasmine.createSpy('listLabelNames').and.resolveTo(['bug', 'Other']),
      createLabel: jasmine.createSpy('createLabel').and.resolveTo(),
      updateLabel: jasmine.createSpy('updateLabel').and.resolveTo()
    };
    factory = jasmine.createSpy('githubClientFactory').and.returnValue(client);
    await writeFile(
      configPath,
      JSON.stringify({ labels: [{ name: 'Bug', color: 'b60205' }, { name: 'Ready for Work', color: 'ffaa04' }] })
    );
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @param {string[]} chunks - the stdin chunks.
   * @param {string} [repoPath] - the context's repo path.
   * @returns {InitClaudeSyncLabels} the command under test.
   */
  function commandFor(chunks, repoPath = dir) {
    return new InitClaudeSyncLabels(new RepoContext({ repoPath }), {
      lineReader: new LineReader({ stream: Readable.from(chunks) }),
      stdout: { write: (text) => stdout.push(text) },
      githubClientFactory: factory
    });
  }

  /**
   * @param {Promise<unknown>} promise - the `run` call.
   * @returns {Promise<DispatchFailure>} the rejection.
   */
  async function failureOf(promise) {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(DispatchFailure);

      return error;
    }

    throw new Error('expected a DispatchFailure');
  }

  it('prints the table, syncs on "y" (case-insensitive update, create) and returns no output', async () => {
    await expectAsync(commandFor(['y\n']).run(configPath)).toBeResolvedTo('');

    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}STATUS=synced\nUPDATED=Bug\nCREATED=Ready for Work\n`);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(client.updateLabel).toHaveBeenCalledOnceWith('bug', 'Bug', 'b60205');
    expect(client.createLabel).toHaveBeenCalledOnceWith('Ready for Work', 'ffaa04');
  });

  it('accepts a whitespace-padded " Y " and "YES"', async () => {
    await commandFor([' \tY \n']).run(configPath);
    await commandFor(['YES\n']).run(configPath);

    expect(client.listLabelNames).toHaveBeenCalledTimes(2);
  });

  it('throws STATUS=discuss / exit 1 on "n", without touching GitHub', async () => {
    const error = await failureOf(commandFor(['no\n']).run(configPath));

    expect(error.stdout).toEqual('STATUS=discuss\n');
    expect(error.exitCode).toEqual(1);
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}`);
    expect(factory).not.toHaveBeenCalled();
  });

  it('re-prompts on unrecognized answers, then syncs', async () => {
    await commandFor(['maybe\n', '\n', 'y\r\n', 'yes\n']).run(configPath);

    expect(stdout.join('')).toEqual(
      `${TABLE}${PROMPT}${PROMPT}${PROMPT}${PROMPT}STATUS=synced\nUPDATED=Bug\nCREATED=Ready for Work\n`
    );
  });

  it('fails with exit 2 on EOF with no input', async () => {
    const error = await failureOf(commandFor([]).run(configPath));

    expect(error.stdout).toEqual('');
    expect(error.exitCode).toEqual(2);
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}`);
    expect(stderr).toHaveBeenCalledOnceWith('Error: no input available for confirmation prompt\n');
  });

  it('treats an unterminated final line as EOF', async () => {
    const error = await failureOf(commandFor(['maybe\n', 'y']).run(configPath));

    expect(error.exitCode).toEqual(2);
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}${PROMPT}`);
    expect(factory).not.toHaveBeenCalled();
  });

  it('fails with the error and usage lines, exit 2, on an invalid config pair', async () => {
    await writeFile(configPath, JSON.stringify({ labels: [{ name: 'Bug', color: 'nothex' }] }));

    const error = await failureOf(commandFor(['y\n']).run(configPath));

    expect(error.exitCode).toEqual(2);
    expect(stdout).toEqual([]);
    expect(stderr).toHaveBeenCalledOnceWith(
      'Error: invalid color \'nothex\' for label \'Bug\' — expected exactly 6 hex digits\n' +
      'Usage: sync_labels.sh <repo_path> [<config_path>]\n' +
      '  config_path defaults to .claude/state/init-claude-config.json\n'
    );
  });

  it('writes the defaults for a missing config, resolving a relative path against repoPath', async () => {
    const error = await failureOf(commandFor(['n\n']).run('.claude/state/init-claude-config.json'));
    const written = JSON.parse(await readFile(path.join(dir, '.claude', 'state', 'init-claude-config.json'), 'utf8'));

    expect(error.exitCode).toEqual(1);
    expect(written.labels.map(({ name, color }) => `${name}:${color}`)).toEqual([...DEFAULT_LABEL_PAIRS]);
    expect(stdout.join('')).toContain('| Spawned | #6a737d |\n');
  });

  it('prints the table and prompt for a non-git repoPath answered "n"', async () => {
    const nonGit = path.join(dir, 'not-a-repo');

    await mkdir(nonGit);

    const error = await failureOf(commandFor(['n\n'], nonGit).run(configPath));

    expect(error.stdout).toEqual('STATUS=discuss\n');
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}`);
  });

  it('propagates a GitHub failure after streaming the partial output', async () => {
    client.createLabel.and.rejectWith(new Error('Error: could not create label'));

    await expectAsync(commandFor(['y\n']).run(configPath)).toBeRejectedWithError('Error: could not create label');
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}STATUS=synced\nUPDATED=Bug\n`);
  });

  it('builds its default GitHub client from the context only after a "yes"', async () => {
    const command = new InitClaudeSyncLabels(new RepoContext({ repoPath: dir }), {
      lineReader: new LineReader({ stream: Readable.from(['y\n']) }),
      stdout: { write: (text) => stdout.push(text) }
    });

    await expectAsync(command.run(configPath)).toBeRejected();
    expect(stdout.join('')).toEqual(`${TABLE}${PROMPT}`);
  });
});
