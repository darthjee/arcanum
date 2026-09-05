import { EventEmitter } from 'node:events';
import path from 'node:path';

export const REPO_PATH = '/repo/path';
export const BOOTSTRAP_PATH = path.join(REPO_PATH, 'arcanum', 'update', 'bootstrap.sh');
export const ARCANUM_JSON_PATH = path.join(REPO_PATH, 'arcanum.json');
export const GIT_DIR_PATH = path.join(REPO_PATH, '.git');

/**
 * Build a fake `existsSync` implementation answering only the paths
 * `ArcanumUpdateRunUpdate` itself probes.
 * @param {Iterable<string>} existingPaths - the paths that "exist".
 * @returns {Function} a jasmine spy usable as `existsSync`.
 */
export function fakeExistsSync(existingPaths) {
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
export function fakeReadFile(sequence) {
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
export function fakeExecFileAsync(handlers) {
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
export function fakeSpawn(exitCode) {
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
export function stubDeps(overrides = {}) {
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
export async function catchError(fn) {
  try {
    await fn();

    return undefined;
  } catch (error) {
    return error;
  }
}
