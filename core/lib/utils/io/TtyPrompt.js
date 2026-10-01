import { closeSync, openSync, readSync, writeSync } from 'node:fs';

const DEFAULT_DEVICE = '/dev/tty';
const NEWLINE = 0x0a;

/**
 * Line-oriented prompt over the controlling terminal (`/dev/tty`),
 * opened directly for read/write so the prompt never touches stdout
 * (which carries a command's `KEY=value` contract). When the device
 * cannot be opened (e.g. inside a Claude Code session, or a process
 * with no controlling terminal) `open()` reports it, and the caller
 * falls back to the exit-`4` / `FALLBACK=chat` contract — see
 * docs/agents/architecture/script-engine.md. Specs inject a fake `fs`
 * (or a fake prompt altogether) so they never touch a real TTY.
 */
class TtyPrompt {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {string} [deps.device] - the terminal device path.
   * @param {object} [deps.fs] - sync `fs` subset (`openSync`,
   *   `readSync`, `writeSync`, `closeSync`).
   */
  constructor({ device = DEFAULT_DEVICE, fs = { openSync, readSync, writeSync, closeSync } } = {}) {
    this._device = device;
    this._fs = fs;
    this._fd = null;
  }

  /**
   * Try to open the terminal device for read/write.
   * @returns {boolean} whether the device is open and usable.
   */
  open() {
    try {
      this._fd = this._fs.openSync(this._device, 'r+');

      return true;
    } catch {
      this._fd = null;

      return false;
    }
  }

  /**
   * Write `question`, read one answer, and map it through `parse`;
   * re-asks while `parse` returns `undefined`.
   * @param {string} question - the prompt text (written as-is).
   * @param {(answer: string) => (object|string|boolean|number|undefined)} parse -
   *   maps a trimmed answer to a result, or `undefined` to re-ask.
   * @returns {object|string|boolean|number|null} the parsed result, or
   *   `null` when the terminal reaches EOF before a valid answer.
   */
  ask(question, parse) {
    for (;;) {
      this._fs.writeSync(this._fd, question);

      const line = this.readLine();

      if (line === null) {
        return null;
      }

      const result = parse(line.trim());

      if (result !== undefined) {
        return result;
      }
    }
  }

  /**
   * Write `text` to the terminal.
   * @param {string} text - the text to write.
   * @returns {void}
   */
  write(text) {
    this._fs.writeSync(this._fd, text);
  }

  /**
   * Read one newline-terminated line, byte by byte.
   * @returns {string|null} the line (without `\n`), or `null` at EOF.
   */
  readLine() {
    const bytes = [];
    const buffer = Buffer.alloc(1);

    for (;;) {
      if (this._readByte(buffer) === 0) {
        return null;
      }

      if (buffer[0] === NEWLINE) {
        return Buffer.from(bytes).toString('utf8');
      }

      bytes.push(buffer[0]);
    }
  }

  /**
   * @param {Buffer} buffer - a one-byte buffer to read into.
   * @returns {number} the bytes read; `0` at EOF or on a read error
   *   (e.g. `EIO` once the terminal hangs up).
   */
  _readByte(buffer) {
    try {
      return this._fs.readSync(this._fd, buffer, 0, 1, null);
    } catch {
      return 0;
    }
  }

  /**
   * Close the terminal device if it is open.
   * @returns {void}
   */
  close() {
    if (this._fd !== null) {
      this._fs.closeSync(this._fd);
      this._fd = null;
    }
  }
}

export default TtyPrompt;
