// The line-based prompter of `arcanum config setup` (see
// docs/agents/architecture/arcanum-cli.md#terminal and
// docs/agents/architecture/arcanum-cli.md#errors-interrupts-and-summary):
// questions go to stderr, answers are read line by line from stdin, and
// EOF (Ctrl-D) or Ctrl-C at a prompt rejects with `Interrupted`.

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
 * @param {{on: (signal: string, handler: () => void) => void, off: (signal: string, handler: () => void) => void}} [streams.signals]
 *   the process signal hooks: while a question is open, the prompter
 *   owns `SIGINT` (removed again between questions).
 * @returns {{ask: (question: string) => Promise<string>, interrupt: (reason?: string) => void, close: () => void}}
 *   `ask` writes the question and resolves the next line, or rejects
 *   with `Interrupted`; `interrupt` stops it; `close` releases the input.
 */
export function createPrompter({ input, output, terminal = Boolean(input.isTTY && output.isTTY), signals = processSignals() }) {
  const rl = readline.createInterface({ input, output, terminal });
  const lines = [];
  let pending = null;
  let stopped = null;
  const onSigint = () => {
    stop('sigint');
    rl.close();
  };
  const settle = () => {
    const current = pending;

    pending = null;
    signals.off('SIGINT', onSigint);

    return current;
  };

  const stop = (reason) => {
    if (stopped !== null) {
      return;
    }

    stopped = reason;

    if (pending !== null) {
      settle().reject(new Interrupted(reason));
    }
  };

  rl.on('line', (line) => {
    if (pending === null) {
      lines.push(line);

      return;
    }

    settle().resolve(line);
  });
  rl.on('SIGINT', onSigint);
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
        signals.on('SIGINT', onSigint);
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

/**
 * @returns {{on: (signal: string, handler: () => void) => void, off: (signal: string, handler: () => void) => void}}
 *   the real process's signal hooks.
 */
function processSignals() {
  return {
    on: (signal, handler) => process.on(signal, handler),
    off: (signal, handler) => process.off(signal, handler)
  };
}
