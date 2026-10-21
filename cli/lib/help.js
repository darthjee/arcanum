// Help-text helpers for the CLI's usage and `--help` output.

/**
 * @returns {string} the top-level usage text, newline-terminated.
 */
export function topLevelUsage() {
  return [
    'Usage: arcanum <command> [options]',
    '',
    'Commands:',
    formatRows([['config', 'Read and write arcanum configuration']]),
    '',
    'Options:',
    formatRows([
      ['-h, --help', 'Show this help'],
      ['--version', 'Print the CLI version'],
      ['--json', 'Machine-readable output']
    ]),
    '',
    'Run \'arcanum <command> --help\' for a command\'s usage.',
    ''
  ].join('\n');
}

/**
 * @param {object[]} entries - the key registry entries, each with
 *   `key` and `description`.
 * @returns {string} the `arcanum config` usage text, listing the
 *   registered keys, newline-terminated.
 */
export function configUsage(entries) {
  return [
    'Usage: arcanum config <subcommand> [options]',
    '',
    'Subcommands (not implemented yet):',
    formatRows([
      ['get <key>', 'Print a key\'s resolved value'],
      ['set <key> <value>', 'Write a key to one tier'],
      ['unset <key>', 'Remove a key from one tier'],
      ['list', 'List every configured key'],
      ['info', 'Describe the environment']
    ]),
    '',
    'Keys:',
    formatRows(entries.map((entry) => [entry.key, entry.description])),
    ''
  ].join('\n');
}

/**
 * Formats two-column rows, indented by two spaces, with the second
 * column aligned.
 * @param {string[][]} rows - `[left, right]` pairs.
 * @returns {string} the rows joined by newlines (no trailing newline).
 */
export function formatRows(rows) {
  const width = Math.max(0, ...rows.map(([left]) => left.length));

  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd()).join('\n');
}
