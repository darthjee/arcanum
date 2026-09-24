import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeSetCiIgnoredPatterns from '../../../../lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import RepoConfigWriter from '../../../../lib/utils/config/RepoConfigWriter.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('InitClaudeSetCiIgnoredPatterns', () => {
  let dir;
  let command;
  let configFile;

  beforeEach(async () => {
    dir = await createTempDir();
    configFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    command = new InitClaudeSetCiIgnoredPatterns(
      new RepoContext({ repoPath: dir }),
      { writer: new RepoConfigWriter({ lock: new Lock({ sleepMs: 5 }) }) }
    );
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @returns {Promise<*>} the written `auto-fix-all.ignored_check_patterns`.
   */
  async function writtenPatterns() {
    return JSON.parse(await readFile(configFile, 'utf8'))['auto-fix-all'].ignored_check_patterns;
  }

  it('writes the given patterns and returns no output', async () => {
    await expectAsync(command.run('lint', 'coverage/*')).toBeResolvedTo('');
    expect(await writtenPatterns()).toEqual(['lint', 'coverage/*']);
  });

  it('writes [] for a lone --clear', async () => {
    await command.run('--clear');

    expect(await writtenPatterns()).toEqual([]);
  });

  it('treats --clear mixed with other args as a literal pattern', async () => {
    await command.run('--clear', 'lint');

    expect(await writtenPatterns()).toEqual(['--clear', 'lint']);
  });

  it('splits arguments containing newlines, like printf | jq -R', async () => {
    await command.run('a\nb', 'c');

    expect(await writtenPatterns()).toEqual(['a', 'b', 'c']);
  });

  it('replaces any existing value', async () => {
    await command.run('old');
    await command.run('new');

    expect(await writtenPatterns()).toEqual(['new']);
  });

  it('seeds from the legacy auto-fix-all.json when the namespace is absent', async () => {
    const legacy = path.join(dir, '.claude', 'configuration', 'auto-fix-all.json');

    await mkdir(path.dirname(legacy), { recursive: true });
    await writeFile(legacy, '{"auto_merge":true}');

    await command.run('lint');

    expect(JSON.parse(await readFile(configFile, 'utf8'))).toEqual({
      'auto-fix-all': { auto_merge: true, ignored_check_patterns: ['lint'] }
    });
  });

  it('rejects with a usage error when given no arguments', async () => {
    await expectAsync(command.run()).toBeRejectedWithError(/^Usage: /);
  });
});
