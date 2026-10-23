// The line-based prompter of `arcanum config setup` (see the TTY
// requirement and Interrupts sections of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md): questions go to
// stderr, answers are read line by line from stdin, and EOF (Ctrl-D) or
// Ctrl-C at a prompt rejects with `Interrupted`.

import readline from 'node:readline';

/** Why the wizard stopped early: `eof` (Ctrl-D, stdin closed) or `sigint` (Ctrl-C). */
export class Interrupted extends Error {
  /**
   * @param {string} reason - `eof` or `sigint`.
   */
  constructor(reason) {
    super(reason === 'eof' ? 'input closed' : 'interrupted');
    this.name = 'Interrupted';
    this.reason = reason;
  }
}

/**
 * Builds a prompter over an input and an output stream. Lines typed
 * before a question is asked are queued, so piped input is never lost.
 * @param {object} streams - the streams.
 * @param {object} streams.input - the input (stdin).
 * @param {object} streams.output - where questions are written (stderr).
 * @param {boolean} [streams.terminal] - whether to treat the streams as
 *   a terminal (line editing, Ctrl-C as `SIGINT`); defaults to whether
 *   both are TTYs, so injected streams use `terminal: false`.
 * @returns {{ask: (question: string) => Promise<string>, close: () => void}}
 *   `ask` writes the question and resolves the next line, or rejects
 *   with `Interrupted`; `close` releases the input.
 */
export function createPrompter({ input, output, terminal = Boolean(input.isTTY && output.isTTY) }) {
  const rl = readline.createInterface({ input, output, terminal });
  const lines = [];
  let pending = null;
  let stopped = null;

  const stop = (reason) => {
    if (stopped !== null) {
      return;
    }

    stopped = reason;

    if (pending !== null) {
      const { reject } = pending;

      pending = null;
      reject(new Interrupted(reason));
    }
  };

  rl.on('line', (line) => {
    if (pending === null) {
      lines.push(line);

      return;
    }

    const { resolve } = pending;

    pending = null;
    resolve(line);
  });
  rl.on('SIGINT', () => {
    stop('sigint');
    rl.close();
  });
  rl.on('close', () => stop('eof'));

  return {
    ask(question) {
      if (lines.length > 0) {
        output.write(question);

        return Promise.resolve(lines.shift());
      }

      if (stopped !== null) {
        return Promise.reject(new Interrupted(stopped));
      }

      rl.setPrompt(question);
      rl.prompt();

      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
      });
    },
    interrupt(reason = 'sigint') {
      stop(reason);
    },
    close() {
      rl.close();
    }
  };
}
