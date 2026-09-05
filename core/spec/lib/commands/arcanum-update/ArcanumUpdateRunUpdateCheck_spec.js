import ArcanumUpdateRunUpdate from '../../../../lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import {
  REPO_PATH,
  BOOTSTRAP_PATH,
  ARCANUM_JSON_PATH,
  GIT_DIR_PATH,
  fakeExistsSync,
  fakeReadFile,
  fakeExecFileAsync,
  stubDeps,
  catchError
} from '../../../support/factories/arcanumUpdateRunUpdate.js';

describe('ArcanumUpdateRunUpdate#check', () => {
  it('resolves METHOD=zip output, reading .repo/.version from arcanum.json', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, ARCANUM_JSON_PATH]),
        readFile: fakeReadFile([JSON.stringify({ repo: 'darthjee/arcanum', version: '1.2.3' })])
      })
    );

    await expectAsync(runUpdate.check(REPO_PATH)).toBeResolvedTo(
      'METHOD=zip\nREPO=darthjee/arcanum\nCURRENT=1.2.3\nTARGET=/repo/path\n'
    );
  });

  it('resolves METHOD=git output, parsing the SSH-form origin URL and an exact tag match', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, GIT_DIR_PATH]),
        execFileAsync: fakeExecFileAsync([
          { match: (file, args) => args.includes('remote'), stdout: 'git@github.com:darthjee/arcanum.git\n' },
          { match: (file, args) => args.includes('describe'), stdout: 'v1.2.3\n' }
        ])
      })
    );

    await expectAsync(runUpdate.check(REPO_PATH)).toBeResolvedTo(
      'METHOD=git\nREPO=darthjee/arcanum\nCURRENT=v1.2.3\nTARGET=/repo/path\n'
    );
  });

  it('resolves METHOD=git output, parsing the HTTPS-form origin URL', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, GIT_DIR_PATH]),
        execFileAsync: fakeExecFileAsync([
          { match: (file, args) => args.includes('remote'), stdout: 'https://github.com/darthjee/arcanum.git\n' },
          { match: (file, args) => args.includes('describe'), stdout: 'v1.2.3\n' }
        ])
      })
    );

    await expectAsync(runUpdate.check(REPO_PATH)).toBeResolvedTo(
      'METHOD=git\nREPO=darthjee/arcanum\nCURRENT=v1.2.3\nTARGET=/repo/path\n'
    );
  });

  it('falls back to the short commit hash when no exact tag matches HEAD', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, GIT_DIR_PATH]),
        execFileAsync: fakeExecFileAsync([
          { match: (file, args) => args.includes('remote'), stdout: 'git@github.com:darthjee/arcanum.git\n' },
          { match: (file, args) => args.includes('describe'), error: new Error('no tag') },
          { match: (file, args) => args.includes('rev-parse'), stdout: 'abc1234\n' }
        ])
      })
    );

    await expectAsync(runUpdate.check(REPO_PATH)).toBeResolvedTo(
      'METHOD=git\nREPO=darthjee/arcanum\nCURRENT=abc1234\nTARGET=/repo/path\n'
    );
  });

  it('rejects with a DispatchFailure (STATUS=missing_arcanum, exit 1) when bootstrap.sh is absent', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(stubDeps({ existsSync: fakeExistsSync([]) }));

    const thrown = await catchError(() => runUpdate.check(REPO_PATH));

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('STATUS=missing_arcanum\n');
    expect(thrown.exitCode).toEqual(1);
  });

  it('rejects with a DispatchFailure when neither arcanum.json nor .git is present', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({ existsSync: fakeExistsSync([BOOTSTRAP_PATH]) })
    );

    const thrown = await catchError(() => runUpdate.check(REPO_PATH));

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('STATUS=missing_arcanum\n');
    expect(thrown.exitCode).toEqual(1);
  });
});
