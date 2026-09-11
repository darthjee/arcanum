import { EventEmitter } from 'node:events';
import path from 'node:path';
import AutoFixIssueRunChecks from '../../../../lib/commands/auto-fix-issue/AutoFixIssueRunChecks.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';

const AGENT = 'node';
const CHECK_SCRIPT = path.join(process.cwd(), '.claude', 'scripts', `check_${AGENT}.sh`);

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
 * @param {boolean} exists - whether `existsSync` should report the check
 *   script as present.
 * @returns {Function} a jasmine spy usable as `existsSync`.
 */
function fakeExistsSync(exists) {
  return jasmine.createSpy('existsSync').and.returnValue(exists);
}

describe('AutoFixIssueRunChecks', () => {
  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when agent is missing', async () => {
        const instance = new AutoFixIssueRunChecks();

        await expectAsync(instance.run('')).toBeRejectedWithError('Usage: run_checks.sh <agent>');
      });
    });

    describe('when the check script does not exist', () => {
      it('resolves to the "no checks configured" message without spawning anything', async () => {
        const existsSync = fakeExistsSync(false);
        const spawnFn = fakeSpawn(0);
        const instance = new AutoFixIssueRunChecks({ existsSync, spawnFn });

        const result = await instance.run(AGENT);

        expect(result).toBe(`No checks configured for agent '${AGENT}' — skipping.\n`);
        expect(existsSync).toHaveBeenCalledWith(CHECK_SCRIPT);
        expect(spawnFn).not.toHaveBeenCalled();
      });
    });

    describe('when the check script exists', () => {
      it('resolves to an empty string when it exits 0', async () => {
        const spawnFn = fakeSpawn(0);
        const instance = new AutoFixIssueRunChecks({ existsSync: fakeExistsSync(true), spawnFn });

        const result = await instance.run(AGENT);

        expect(result).toBe('');
      });

      it('runs it via bash with stdio "inherit" and the exact resolved path', async () => {
        const spawnFn = fakeSpawn(0);
        const instance = new AutoFixIssueRunChecks({ existsSync: fakeExistsSync(true), spawnFn });

        await instance.run(AGENT);

        expect(spawnFn).toHaveBeenCalledTimes(1);
        const [file, spawnArgs, options] = spawnFn.calls.mostRecent().args;

        expect(file).toBe('bash');
        expect(spawnArgs).toEqual([CHECK_SCRIPT]);
        expect(options.stdio).toBe('inherit');
      });

      it('rejects with a DispatchFailure (empty stdout, exit code 1) when it exits 1', async () => {
        const instance = new AutoFixIssueRunChecks({ existsSync: fakeExistsSync(true), spawnFn: fakeSpawn(1) });

        const error = await instance.run(AGENT).then(
          () => Promise.reject(new Error('expected run() to reject')),
          (rejected) => rejected
        );

        expect(error).toBeInstanceOf(DispatchFailure);
        expect(error.stdout).toBe('');
        expect(error.exitCode).toBe(1);
      });

      it('rejects with a DispatchFailure carrying the exact nonzero exit code, e.g. 3', async () => {
        const instance = new AutoFixIssueRunChecks({ existsSync: fakeExistsSync(true), spawnFn: fakeSpawn(3) });

        const error = await instance.run(AGENT).then(
          () => Promise.reject(new Error('expected run() to reject')),
          (rejected) => rejected
        );

        expect(error).toBeInstanceOf(DispatchFailure);
        expect(error.stdout).toBe('');
        expect(error.exitCode).toBe(3);
      });
    });
  });
});
