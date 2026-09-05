import ArcanumUpdateRunUpdate from '../../../../lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import {
  REPO_PATH,
  BOOTSTRAP_PATH,
  ARCANUM_JSON_PATH,
  fakeExistsSync,
  fakeReadFile,
  fakeSpawn,
  stubDeps,
  catchError
} from '../../../support/factories/arcanumUpdateRunUpdate.js';

describe('ArcanumUpdateRunUpdate#apply', () => {
  it('runs bootstrap.sh with stdio "inherit" and ARCANUM_ASSUME_YES=1, resolving RESULT=updated on a version change', async () => {
    const spawnFn = fakeSpawn(0);
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, ARCANUM_JSON_PATH]),
        readFile: fakeReadFile([
          JSON.stringify({ repo: 'darthjee/arcanum', version: '1.0.0' }),
          JSON.stringify({ repo: 'darthjee/arcanum', version: '1.0.0' }),
          JSON.stringify({ repo: 'darthjee/arcanum', version: '1.1.0' })
        ]),
        spawnFn
      })
    );

    await expectAsync(runUpdate.apply(REPO_PATH)).toBeResolvedTo('RESULT=updated FROM=1.0.0 TO=1.1.0\n');

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [file, spawnArgs, options] = spawnFn.calls.mostRecent().args;

    expect(file).toEqual(BOOTSTRAP_PATH);
    expect(spawnArgs).toEqual([]);
    expect(options.stdio).toEqual('inherit');
    expect(options.env.ARCANUM_ASSUME_YES).toEqual('1');
  });

  it('resolves RESULT=noop when the version is unchanged after bootstrap.sh runs', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, ARCANUM_JSON_PATH]),
        readFile: fakeReadFile([JSON.stringify({ repo: 'darthjee/arcanum', version: '1.0.0' })]),
        spawnFn: fakeSpawn(0)
      })
    );

    await expectAsync(runUpdate.apply(REPO_PATH)).toBeResolvedTo('RESULT=noop VERSION=1.0.0\n');
  });

  it('rejects with a DispatchFailure (empty stdout, bootstrap.sh\'s exit code) when bootstrap.sh exits nonzero', async () => {
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({
        existsSync: fakeExistsSync([BOOTSTRAP_PATH, ARCANUM_JSON_PATH]),
        readFile: fakeReadFile([JSON.stringify({ repo: 'darthjee/arcanum', version: '1.0.0' })]),
        spawnFn: fakeSpawn(3)
      })
    );

    const thrown = await catchError(() => runUpdate.apply(REPO_PATH));

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('');
    expect(thrown.exitCode).toEqual(3);
  });

  it('rejects with a DispatchFailure (STATUS=missing_arcanum) without spawning bootstrap.sh at all', async () => {
    const spawnFn = fakeSpawn(0);
    const runUpdate = new ArcanumUpdateRunUpdate(
      stubDeps({ existsSync: fakeExistsSync([]), spawnFn })
    );

    const thrown = await catchError(() => runUpdate.apply(REPO_PATH));

    expect(thrown).toBeInstanceOf(DispatchFailure);
    expect(thrown.stdout).toEqual('STATUS=missing_arcanum\n');
    expect(thrown.exitCode).toEqual(1);
    expect(spawnFn).not.toHaveBeenCalled();
  });
});
