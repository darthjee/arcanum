/**
 * Build a jasmine spy standing in for `execFileAsync` that records every
 * call's `args` and resolves with a fixed `{ stdout, stderr }`, for specs
 * that only need to assert *which* git commands were invoked.
 * @param {string} [stdout] - the stubbed stdout for every call.
 * @returns {{ execFileAsync: jasmine.Spy, calls: Array<string[]> }} the spy and its recorded call args.
 */
export function trackedExecFileAsync(stdout = '') {
  const calls = [];
  const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
    calls.push(args);

    return Promise.resolve({ stdout, stderr: '' });
  });

  return { execFileAsync, calls };
}
