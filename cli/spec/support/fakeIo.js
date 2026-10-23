import { PassThrough } from 'node:stream';

/**
 * @param {object} [options] - the fake streams' options.
 * @param {string[]} [options.stdin] - lines to feed on a fake stdin,
 *   which then ends (EOF); absent: no stdin at all.
 * @param {boolean} [options.tty] - whether stdin and stderr claim to be
 *   terminals (`isTTY`).
 * @returns {{stdout: object, stderr: object, stdin: (object|undefined), out: () => string, err: () => string}}
 *   in-memory streams for `run`, with accessors for what was written.
 */
export function fakeIo({ stdin, tty = false } = {}) {
  const chunks = { stdout: [], stderr: [] };
  const io = {
    stdout: { write: (text) => chunks.stdout.push(text) },
    stderr: { write: (text) => chunks.stderr.push(text) },
    out: () => chunks.stdout.join(''),
    err: () => chunks.stderr.join('')
  };

  if (stdin !== undefined) {
    io.stdin = new PassThrough();
    io.stdin.end(stdin.map((line) => `${line}\n`).join(''));
  }

  if (tty) {
    io.stderr.isTTY = true;

    if (io.stdin) {
      io.stdin.isTTY = true;
    }
  }

  return io;
}
