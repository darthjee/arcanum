import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeStampArcanumVersion from '../../../../lib/commands/init-claude/InitClaudeStampArcanumVersion.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import RepoConfigWriter from '../../../../lib/utils/config/RepoConfigWriter.js';
import InstallVersion from '../../../../lib/utils/file/InstallVersion.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { fakeExecFileAsync } from '../../../support/utils/fakeExecFileAsync.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('InitClaudeStampArcanumVersion', () => {
  let repo;
  let install;
  let committed;
  let local;

  beforeEach(async () => {
    repo = await createTempDir();
    install = await createTempDir();
    committed = path.join(repo, '.claude', 'configuration', 'arcanum-repo-config.json');
    local = path.join(repo, '.claude', 'state', 'arcanum-config.json');
  });

  afterEach(async () => {
    await removeTempDir(repo);
    await removeTempDir(install);
  });

  /**
   * @param {string|Error} [describeResult] - `git describe`'s stdout, or
   *   an error to throw.
   * @returns {InitClaudeStampArcanumVersion} the command, bound to the
   *   temp repo/install.
   */
  function build(describeResult = new Error('no tag')) {
    const execFileAsync = fakeExecFileAsync('git', [{
      match: (args) => args.includes('describe'),
      respond: () => {
        if (describeResult instanceof Error) {
          throw describeResult;
        }

        return { stdout: describeResult };
      }
    }]);

    return new InitClaudeStampArcanumVersion(new RepoContext({ repoPath: repo }), {
      installVersion: new InstallVersion({ execFileAsync }),
      writer: new RepoConfigWriter({ lock: new Lock({ sleepMs: 5 }) }),
      installRoot: install
    });
  }

  /**
   * @returns {Promise<void>} resolves once stamping has been verified.
   */
  async function expectStamped() {
    expect(JSON.parse(await readFile(committed, 'utf8'))).toEqual({ version: '1.2.3' });
    expect(JSON.parse(await readFile(local, 'utf8'))).toEqual({ migrations: { version: '1.2.3' } });
  }

  /**
   * @returns {void}
   */
  function expectUntouched() {
    expect(existsSync(committed)).toBeFalse();
    expect(existsSync(local)).toBeFalse();
  }

  it('stamps the zip install version from arcanum.json', async () => {
    await writeFile(path.join(install, 'arcanum.json'), '{"version":"1.2.3"}');

    await expectAsync(build().run()).toBeResolvedTo('');
    await expectStamped();
  });

  it('stamps the exact git tag for a git-clone install', async () => {
    await mkdir(path.join(install, '.git'));

    await expectAsync(build('1.2.3\n').run()).toBeResolvedTo('');
    await expectStamped();
  });

  it('preserves existing keys in both files', async () => {
    await writeFile(path.join(install, 'arcanum.json'), '{"version":"1.2.3"}');
    await mkdir(path.dirname(committed), { recursive: true });
    await writeFile(committed, '{"version":"0.1.0","auto-fix-all":{"x":1}}');
    await mkdir(path.dirname(local), { recursive: true });
    await writeFile(local, '{"git":{"safe_branch":"b"},"migrations":{"version":"0.1.0"}}');

    await build().run();

    expect(await readFile(committed, 'utf8'))
      .toEqual('{\n  "version": "1.2.3",\n  "auto-fix-all": {\n    "x": 1\n  }\n}\n');
    expect(JSON.parse(await readFile(local, 'utf8')))
      .toEqual({ git: { safe_branch: 'b' }, migrations: { version: '1.2.3' } });
  });

  it('is a silent no-op when HEAD has no exact tag', async () => {
    await mkdir(path.join(install, '.git'));

    await expectAsync(build().run()).toBeResolvedTo('');
    expectUntouched();
  });

  it('is a silent no-op for a non-semver version', async () => {
    await mkdir(path.join(install, '.git'));

    await expectAsync(build('v1.2.3\n').run()).toBeResolvedTo('');
    expectUntouched();
  });

  it('is a silent no-op for a non-semver arcanum.json version', async () => {
    await writeFile(path.join(install, 'arcanum.json'), '{"version":"1.2.3-rc1"}');

    await expectAsync(build().run()).toBeResolvedTo('');
    expectUntouched();
  });

  it('is a silent no-op when neither arcanum.json nor .git exists', async () => {
    await expectAsync(build('1.2.3\n').run()).toBeResolvedTo('');
    expectUntouched();
  });

  it('swallows resolution errors', async () => {
    const command = new InitClaudeStampArcanumVersion(new RepoContext({ repoPath: repo }), {
      installVersion: { resolve: () => Promise.reject(new Error('boom')) },
      installRoot: install
    });

    await expectAsync(command.run()).toBeResolvedTo('');
    expectUntouched();
  });
});
