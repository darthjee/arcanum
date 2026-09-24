const NEWLINE = 0x0a;

/**
 * Reads newline-terminated lines from a readable stream, mirroring
 * bash's `read` semantics: only a line ending in `\n` counts, and a
 * final unterminated chunk is treated as EOF (unlike `readline`, which
 * emits it as a last line). Lines are returned without the `\n`, with
 * no other trimming.
 */
class LineReader {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('node:stream').Readable} [deps.stream] - the input
   *   stream (`process.stdin` by default).
   */
  constructor({ stream = process.stdin } = {}) {
    this._stream = stream;
    this._iterator = null;
    this._buffer = Buffer.alloc(0);
    this._done = false;
  }

  /**
   * Read the next newline-terminated line.
   * @returns {Promise<string|null>} the line (without its `\n`), or
   *   `null` at EOF — including when only an unterminated chunk remains.
   */
  async readLine() {
    for (;;) {
      const index = this._buffer.indexOf(NEWLINE);

      if (index !== -1) {
        const line = this._buffer.subarray(0, index).toString('utf8');

        this._buffer = this._buffer.subarray(index + 1);

        return line;
      }

      if (this._done) {
        return null;
      }

      await this._pull();
    }
  }

  /**
   * Stop reading and release the underlying stream, so an open stdin
   * does not keep the process alive.
   * @returns {Promise<void>}
   */
  async close() {
    this._done = true;

    if (this._iterator && typeof this._iterator.return === 'function') {
      const iterator = this._iterator;

      this._iterator = null;
      await iterator.return();
    }
  }

  /**
   * Pull one chunk from the stream into the buffer.
   * @returns {Promise<void>}
   * @private
   */
  async _pull() {
    if (!this._iterator) {
      this._iterator = this._stream[Symbol.asyncIterator]();
    }

    const { value, done } = await this._iterator.next();

    if (done) {
      this._done = true;
      return;
    }

    const chunk = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);

    this._buffer = Buffer.concat([this._buffer, chunk]);
  }
}

export default LineReader;
