/**
 * Scripted stand-in for `TtyPrompt`, so specs never touch a real
 * `/dev/tty`: `open()` reports `available`, `ask()` feeds `answers` (in
 * order) through the caller's `parse`, re-asking like the real prompt,
 * and returns `null` once the answers run out (EOF). Everything written
 * is captured in `output`.
 */
class FakeTty {
  /**
   * @param {object} [opts] - behavior.
   * @param {boolean} [opts.available] - whether `open()` succeeds.
   * @param {string[]} [opts.answers] - the scripted answers.
   */
  constructor({ available = true, answers = [] } = {}) {
    this.available = available;
    this.answers = [...answers];
    this.output = '';
    this.questions = [];
    this.closed = false;
  }

  /**
   * @returns {boolean} whether the fake TTY is available.
   */
  open() {
    return this.available;
  }

  /**
   * @param {string} text - the text to capture.
   * @returns {void}
   */
  write(text) {
    this.output += text;
  }

  /**
   * @param {string} question - the prompt text.
   * @param {(answer: string) => (object|string|boolean|number|undefined)} parse -
   *   the answer parser.
   * @returns {object|string|boolean|number|null} the parsed result, or
   *   `null` once answers run out.
   */
  ask(question, parse) {
    for (;;) {
      this.questions.push(question);
      this.output += question;

      if (this.answers.length === 0) {
        return null;
      }

      const result = parse(this.answers.shift().trim());

      if (result !== undefined) {
        return result;
      }
    }
  }

  /**
   * @returns {void}
   */
  close() {
    this.closed = true;
  }
}

export default FakeTty;
