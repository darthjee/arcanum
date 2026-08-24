import { EventEmitter } from 'node:events';
import path from 'node:path';
import ArcanumUpdateRunUpdate from '../../../lib/commands/ArcanumUpdateRunUpdate.js';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';

const REPO_PATH = '/repo/path';
const BOOTSTRAP_PATH = path.join(REPO_PATH, 'arcanum', 'update', 'bootstrap.sh');
const ARCANUM_JSON_PATH = path.join(REPO_PATH, 'arcanum.json');
const GIT_DIR_PATH = path.join(REPO_PATH, '.git');

/**
 * Build a fake `existsSync` implementation answering only the paths
 * `ArcanumUpdateRunUpdate` itself probes.
 * @param {Iterable<string>} existingPaths - the paths that "exist".
 * @returns {Function} a jasmine spy usable as `existsSync`.
 */
function fakeExistsSync(existingPaths) {
  const set = new Set(existingPaths);

  return jasmine.createSpy('existsSync').and.callFake((file) => set.has(file));
}

/**
 * Build a fake `readFile` implementation that returns one entry from
 * `sequence` per call (the last entry repeats once exhausted) —
 * regardless of which file is asked for, since every spec below only
 * ever reads `arcanum.json`.
 * @param {string[]} sequence - the JSON strings to return, in call order.
 * @returns {Function} a jasmine spy usable as `readFile`.
 */
function fakeReadFile(sequence) {
  let index = 0;

  return jasmine.createSpy('readFile').and.callFake(async () => {
    const value = sequence[Math.min(index, sequence.length - 1)];

    index += 1;

    return value;
  });
}

/**
 * Build a fake `execFileAsync` implementation answering `git` calls via
 * a caller-supplied matcher list, evaluated in order.
 * @param {Array<object>} handlers - each entry's `match(file, args)`
 *   decides whether it answers a call; `stdout` is returned wrapped in
 *   `{ stdout }`, or `error` is thrown instead when present.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync(handlers) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (file, args = []) => {
    const handler = handlers.find((candidate) => candidate.match(file, args));

    if (!handler) {
      throw new Error(`unexpected execFileAsync call: ${file} ${JSON.stringify(args)}`);
    }

    if (handler.error) {
      throw handler.error;
    }

    return { stdout: handler.stdout };
  });
}

/**
 * Build a fake `spawnFn` implementation whose returned "child" emits a
 * `'close'` event (asynchronously, matching real `child_process.spawn`)
 * with `exitCode`.
 * @param {number} exitCode - the exit code to emit on `'close'`.
 * @returns {Function} a jasmine spy usable as `spawnFn`.
 */
function fakeSpawn(exitCode) {
  return jasmine.createSpy('spawn').and.callFake(() => {
    const child = new EventEmitter();

    queueMicrotask(() => {
      child.emit('close', exitCode);
    });

    return child;
  });
}

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {object} a set of stub collaborators for ArcanumUpdateRunUpdate.
 */
function stubDeps(overrides = {}) {
  return {
    execFileAsync: fakeExecFileAsync([]),
    spawnFn: fakeSpawn(0),
    readFile: fakeReadFile(['{}']),
    existsSync: fakeExistsSync([BOOTSTRAP_PATH]),
    ...overrides
  };
}

/**
 * @param {Function} fn - a zero-argument async function to invoke.
 * @returns {Promise<Error|undefined>} whatever `fn` threw/rejected
 *   with, or `undefined` if `fn` didn't throw.
 */
async function catchError(fn) {
  try {
    await fn();

    return undefined;
  } catch (error) {
    return error;
  }
}

describe('ArcanumUpdateRunUpdate', () => {
  describe('#check', () => {
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

  describe('#apply', () => {
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
});
