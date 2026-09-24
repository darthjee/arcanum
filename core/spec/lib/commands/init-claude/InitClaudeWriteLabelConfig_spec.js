import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeWriteLabelConfig from '../../../../lib/commands/init-claude/InitClaudeWriteLabelConfig.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('InitClaudeWriteLabelConfig', () => {
  let dir;
  let configPath;
  let command;
  let stderr;

  beforeEach(async () => {
    dir = await createTempDir();
    configPath = path.join(dir, '.claude', 'state', 'labels.json');
    command = new InitClaudeWriteLabelConfig(new RepoContext({ repoPath: dir }));
    stderr = spyOn(process.stderr, 'write').and.returnValue(true);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @returns {Promise<string[]>} the written labels as `name:color`.
   */
  async function writtenPairs() {
    const { labels } = JSON.parse(await readFile(configPath, 'utf8'));

    return labels.map(({ name, color }) => `${name}:${color}`);
  }

  /**
   * @param {Promise<unknown>} promise - the command call.
   * @param {string} message - the expected stderr line.
   * @returns {Promise<void>} resolves once asserted.
   */
  async function expectUsageFailure(promise, message) {
    await expectAsync(promise).toBeRejectedWith(jasmine.any(DispatchFailure));
    await promise.catch((error) => {
      expect(error.stdout).toEqual('');
      expect(error.exitCode).toEqual(2);
    });
    expect(stderr).toHaveBeenCalledOnceWith(`${message}\n`);
    expect(existsSync(configPath)).toBeFalse();
  }

  describe('#replace', () => {
    it('writes exactly the given pairs and returns no output', async () => {
      await command.add(configPath, 'Old:000000');

      await expectAsync(command.replace(configPath, 'A:111111', 'B:222222')).toBeResolvedTo('');
      expect(await writtenPairs()).toEqual(['A:111111', 'B:222222']);
    });

    it('resolves a relative configPath against repoPath', async () => {
      await command.replace('.claude/state/labels.json', 'A:111111');

      expect(await writtenPairs()).toEqual(['A:111111']);
    });

    it('rejects an invalid pair with exit 2, leaving the file untouched', async () => {
      await expectUsageFailure(
        command.replace(configPath, 'A:111111', 'nocolon'),
        'Error: invalid pair \'nocolon\' — expected <label name>:<hex color>'
      );
    });
  });

  describe('#remove', () => {
    it('removes the given names', async () => {
      await command.add(configPath, 'A:111111', 'B:222222');

      await expectAsync(command.remove(configPath, 'A', 'Missing')).toBeResolvedTo('');
      expect(await writtenPairs()).toEqual(['B:222222']);
    });

    it('rejects a name:color argument with exit 2', async () => {
      await expectUsageFailure(
        command.remove(configPath, 'A:111111'),
        'Error: invalid label name \'A:111111\' — remove takes bare names, not <name>:<color> pairs'
      );
    });
  });

  describe('#add', () => {
    it('upserts pairs by name', async () => {
      await command.add(configPath, 'A:111111', 'B:222222');

      await expectAsync(command.add(configPath, 'C:333333', 'A:aaaaaa')).toBeResolvedTo('');
      expect(await writtenPairs()).toEqual(['A:aaaaaa', 'B:222222', 'C:333333']);
    });

    it('rejects an empty name with exit 2', async () => {
      await expectUsageFailure(command.add(configPath, ':111111'), 'Error: invalid pair \':111111\' — label name is empty');
    });

    it('rejects a bad color with exit 2', async () => {
      await expectUsageFailure(
        command.add(configPath, 'A:12345'),
        'Error: invalid color \'12345\' for label \'A\' — expected exactly 6 hex digits'
      );
    });
  });
});
