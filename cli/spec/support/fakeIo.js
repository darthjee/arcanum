/**
 * @returns {{stdout: object, stderr: object, out: () => string, err: () => string}}
 *   in-memory output streams for `run`, with accessors for what was written.
 */
export function fakeIo() {
  const chunks = { stdout: [], stderr: [] };

  return {
    stdout: { write: (text) => chunks.stdout.push(text) },
    stderr: { write: (text) => chunks.stderr.push(text) },
    out: () => chunks.stdout.join(''),
    err: () => chunks.stderr.join('')
  };
}
