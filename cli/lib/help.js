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
    'Subcommands:',
    formatRows(Object.values(SUBCOMMAND_HELP).map((help) => [help.synopsis.replace(/ \[.*$| \(.*$/, ''), help.summary])),
    '',
    'Options:',
    formatRows(TARGETING_ROWS),
    '',
    'Keys:',
    formatRows(entries.map((entry) => [entry.key, entry.description])),
    '',
    'Run \'arcanum config <subcommand> --help\' for a subcommand\'s usage.',
    ''
  ].join('\n');
}

const TIER_ROWS = [
  ['--global', 'The global tier ($CLAUDE_CONFIG_DIR/arcanum-config.json)'],
  ['--repo', 'The repo tier (.claude/configuration/arcanum-repo-config.json)'],
  ['--local', 'The local tier (.claude/state/arcanum-config.json)']
];

const WRITE_ROWS = [
  ['--force', 'Allow an unknown key, or a tier newer than this CLI'],
  ['--lock-timeout <seconds>', 'Wait at most this long for the lock (default 10, 0: try once)']
];

const TARGETING_ROWS = [
  ['--repo <path>', 'Target the repo at <path> (a path with a /, or . or ..)'],
  ['--claude-config-dir <dir>', 'Target that Claude config dir (overrides CLAUDE_CONFIG_DIR)'],
  ['--json', 'Machine-readable output'],
  ['-h, --help', 'Show this help']
];

/** Each `config` subcommand's synopsis, summary and own options. */
export const SUBCOMMAND_HELP = {
  get: {
    synopsis: 'get <key> [--global|--repo|--local] [--all-tiers]',
    summary: 'Print a key\'s resolved value and its source tier',
    rows: [...TIER_ROWS.map(([flag, text]) => [flag, `Read only ${text.replace(/^The /, 'the ')}`]),
      ['--all-tiers', 'Show every tier\'s value, shadowed ones included']]
  },
  set: {
    synopsis: 'set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]',
    summary: 'Write a key to one tier',
    rows: [...TIER_ROWS, ['--string', 'Store the value as a string, never as JSON'], ...WRITE_ROWS]
  },
  unset: {
    synopsis: 'unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]',
    summary: 'Remove a key from one tier',
    rows: [...TIER_ROWS, ...WRITE_ROWS]
  },
  list: {
    synopsis: 'list [--global|--repo|--local]',
    summary: 'List every configured key, flattened',
    rows: TIER_ROWS.map(([flag, text]) => [flag, `List only ${text.replace(/^The /, 'the ')}`])
  },
  info: {
    synopsis: 'info',
    summary: 'Describe the environment: account, repo, tier files, versions',
    rows: []
  }
};

/**
 * @param {string} name - a `config` subcommand.
 * @returns {string} its usage text, newline-terminated.
 */
export function subcommandUsage(name) {
  const help = SUBCOMMAND_HELP[name];

  return [
    `Usage: arcanum config ${help.synopsis}`,
    '',
    `${help.summary}.`,
    '',
    'Options:',
    formatRows([...help.rows, ...TARGETING_ROWS]),
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
