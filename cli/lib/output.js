// The CLI's output layer (see the Output, JSON output and Error messages
// sections of docs/agents/specs/arcanum-cli/command-surface.md): stdout
// carries only the result; every warning and error goes to stderr.

import { EXIT_IDENTIFIERS, EXIT_USAGE, exitCodeForError } from './exitCodes.js';

/**
 * @param {unknown} error - the thrown value.
 * @returns {string} its one-line message, without the `arcanum: `
 *   prefix (or a leading `Error: ` some shared messages carry).
 */
export function errorMessage(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : String(error);

  return message.replace(/^(arcanum: |Error: )/, '');
}

/**
 * Prints an error on stderr and returns its exit code: in human mode,
 * `arcanum: <message>`, then an optional `hint: ` line (a usage error
 * without a hint points at `--help`), plus the stack under
 * `ARCANUM_DEBUG=1`; in `--json` mode, the stable error object.
 * @param {{stderr: {write: (text: string) => void}}} io - output streams.
 * @param {unknown} error - the thrown value.
 * @param {object} [options] - reporting options.
 * @param {boolean} [options.json] - `--json` mode.
 * @param {object} [options.env] - the environment (`ARCANUM_DEBUG`).
 * @returns {number} the exit code.
 */
export function reportError(io, error, { json = false, env = {} } = {}) {
  const exit = exitCodeForError(error);
  const message = `arcanum: ${errorMessage(error)}`;
  const hint = error && typeof error === 'object' && typeof error.hint === 'string' ? error.hint : null;

  if (json) {
    io.stderr.write(`${JSON.stringify({ error: { code: EXIT_IDENTIFIERS[exit], exit, message, hint } })}\n`);
  } else {
    io.stderr.write(`${message}\n`);

    if (hint !== null) {
      io.stderr.write(`hint: ${hint}\n`);
    } else if (exit === EXIT_USAGE) {
      io.stderr.write('Run \'arcanum --help\' for usage.\n');
    }
  }

  if (env.ARCANUM_DEBUG === '1' && error && typeof error === 'object' && error.stack) {
    io.stderr.write(`${error.stack}\n`);
  }

  return exit;
}

/**
 * Builds a command's output helpers, so each command only builds its
 * data and its human text.
 * @param {{stdout: {write: (text: string) => void}, stderr: {write: (text: string) => void}}} io - output streams.
 * @param {object} [options] - output options.
 * @param {boolean} [options.json] - `--json` mode.
 * @returns {{json: boolean, result: (human: string, data: object) => void, warn: (message: string) => void}}
 *   `result` prints the human text, or the data as exactly one JSON
 *   object line under `--json`; `warn` prints a plain-text stderr
 *   warning in both modes.
 */
export function createOutput(io, { json = false } = {}) {
  return {
    json,
    result(human, data) {
      if (json) {
        io.stdout.write(`${JSON.stringify(data)}\n`);
      } else if (human !== '') {
        io.stdout.write(human.endsWith('\n') ? human : `${human}\n`);
      }
    },
    warn(message) {
      io.stderr.write(`arcanum: warning: ${message}\n`);
    }
  };
}

/**
 * Formats a value for human output: strings without quotes, anything
 * else as compact JSON.
 * @param {unknown} value - a config value.
 * @returns {string} the printable form.
 */
export function formatValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * @param {string[]} argv - the raw arguments.
 * @returns {boolean} whether `--json` appears before any `--`, for
 *   errors raised before `parseArgs` has run.
 */
export function wantsJson(argv) {
  const end = argv.indexOf('--');

  return (end === -1 ? argv : argv.slice(0, end)).includes('--json');
}
