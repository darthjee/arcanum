// Help-text helpers for the CLI's usage and `--help` output.

import { SETUP_SECTIONS } from '../../shared/lib/config/KeyRegistry.js';

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
    'Shortcuts:',
    formatRows(Object.entries(SHORTCUT_HELP).map(([name, help]) => [name, help.summary])),
    '',
    'Options:',
    formatRows(TARGETING_ROWS),
    '',
    'Keys:',
    formatRows(entries.map((entry) => [entry.key, entry.description])),
    '',
    'Run \'arcanum config <subcommand> --help\' for a subcommand\'s usage,',
    'or \'arcanum config <shortcut> --help\' for a shortcut\'s.',
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
  },
  setup: {
    synopsis: 'setup [<section>...] [--lock-timeout <seconds>]',
    summary: 'Walk through the onboarding settings interactively',
    rows: [WRITE_ROWS[1]],
    notes: [
      `Sections, always asked in this order: ${SETUP_SECTIONS.join(', ')} (default: all).`,
      'Needs an interactive terminal; prompts go to stderr. Each confirmed answer is',
      'written at once, like \'config set\'/\'config unset\'. --json is not accepted.'
    ]
  }
};

const SINGLE_VALUE_ROWS = [
  ['--unset', 'Remove the key from the write tier'],
  ['--global|--repo|--local', 'Write to that tier instead of the default; on a read, read only that tier'],
  ['--all-tiers', 'On a read, show every tier\'s value, shadowed ones included'],
  ['--lock-timeout <seconds>', 'On a write, wait at most this long for the lock (default 10)']
];

const SINGLE_VALUE_NOTES = [
  'With no value, prints the value like \'config get\'; with a value, writes it like',
  '\'config set\'. Output, JSON and exit codes are those of the generic command.',
  '--force and --string are not accepted: use \'config set\' for those.'
];

const BOOLEAN_NOTE = 'Booleans: on, off, true or false (lowercase), stored as JSON true/false; off shadows a lower tier\'s on.';

/**
 * Each shortcut's synopsis, summary, own options and notes, keyed by the
 * shortcut as typed after `arcanum config`.
 */
export const SHORTCUT_HELP = {
  'agents email': {
    synopsis: 'agents email [<agent>] | set <pattern> | set <agent> <email> | unset [<agent>]',
    summary: 'Show each agent\'s effective commit email, or set git.email / git.agents.<agent> (default: global)',
    rows: [
      ['--global|--repo|--local', 'set/unset: write to that tier instead of the global one'],
      ['--lock-timeout <seconds>', 'set/unset: wait at most this long for the lock (default 10)']
    ],
    notes: [
      'With no argument, lists the default git.email and every agent (configured, or in',
      'the repo\'s .claude/agents/*.md) with the email it commits with and where it comes from.',
      'With <agent>, shows both keys in every tier; exits 1 when the model email would apply.',
      'set <pattern> writes git.email ({agent} is replaced by the agent name);',
      'set <agent> <email> writes git.agents.<agent>. Default write tier: global.'
    ]
  },
  engine: {
    synopsis: 'engine [shell|native|docker | --unset]',
    summary: 'Read or set engine.mode (default write tier: local)',
    rows: SINGLE_VALUE_ROWS,
    notes: SINGLE_VALUE_NOTES
  },
  'next-step auto': {
    synopsis: 'next-step auto [<skill> [on|off | --unset]]',
    summary: 'List the next_step.auto.* keys set, or read or set one skill\'s (default write tier: local)',
    rows: SINGLE_VALUE_ROWS,
    notes: [
      'With no <skill>, lists every set next_step.auto.<skill>, resolved and sorted; always exits 0.',
      'Any well-formed skill name is accepted.',
      ...SINGLE_VALUE_NOTES,
      BOOLEAN_NOTE
    ]
  },
  'git safe-branch': {
    synopsis: 'git safe-branch [<ref> | --unset]',
    summary: 'Read or set git.safe_branch (local tier only)',
    rows: SINGLE_VALUE_ROWS,
    notes: [...SINGLE_VALUE_NOTES, 'The ref is stored as typed.']
  },
  'git merge-body': {
    synopsis: 'git merge-body [full|empty|coauthors | --unset]',
    summary: 'Read or set git.merge_body_mode (default write tier: local)',
    rows: SINGLE_VALUE_ROWS,
    notes: SINGLE_VALUE_NOTES
  },
  'auto-fix-all clear-context': {
    synopsis: 'auto-fix-all clear-context [on|off | --unset]',
    summary: 'Read or set auto-fix-all.clear_context (local tier only)',
    rows: SINGLE_VALUE_ROWS,
    notes: [...SINGLE_VALUE_NOTES, BOOLEAN_NOTE]
  },
  'auto-fix-all finish-on-empty-queue': {
    synopsis: 'auto-fix-all finish-on-empty-queue [on|off | --unset]',
    summary: 'Read or set auto-fix-all.finish_on_empty_queue (local tier only)',
    rows: SINGLE_VALUE_ROWS,
    notes: [...SINGLE_VALUE_NOTES, BOOLEAN_NOTE]
  },
  'auto-fix-all ignore-checks': {
    synopsis: 'auto-fix-all ignore-checks [list] | add <pattern>... | remove <pattern>...',
    summary: 'List or edit auto-fix-all.ignored_check_patterns (repo tier only)',
    rows: [
      ['--repo', 'The only tier accepted (--local and --global exit 3)'],
      ['--lock-timeout <seconds>', 'add/remove: wait at most this long for the lock (default 10)']
    ],
    notes: [
      'Patterns are case-insensitive regexes (as new RegExp(p, \'i\')), not globs.',
      'add appends in order and skips patterns already present; remove skips missing ones.',
      'Patterns match by exact string. Use -- before a pattern starting with -.',
      'An invalid regex is refused (exit 3) and nothing is written.'
    ]
  },
  'monitor-issues clear-context': {
    synopsis: 'monitor-issues clear-context [on|off | --unset]',
    summary: 'Read or set monitor-issues.clear_context (local tier only)',
    rows: SINGLE_VALUE_ROWS,
    notes: [...SINGLE_VALUE_NOTES, BOOLEAN_NOTE]
  }
};

/**
 * @param {string} namespace - a shortcut namespace (e.g. `git`).
 * @param {(string|undefined)} name - the word after it, if any.
 * @returns {string} the shortcut's usage, or the namespace's (listing
 *   its shortcuts) when `name` names none, newline-terminated.
 */
export function shortcutUsage(namespace, name) {
  const full = name === undefined ? namespace : `${namespace} ${name}`;
  const key = Object.hasOwn(SHORTCUT_HELP, full) ? full : namespace;

  if (Object.hasOwn(SHORTCUT_HELP, key)) {
    const help = SHORTCUT_HELP[key];

    return [
      `Usage: arcanum config ${help.synopsis}`,
      '',
      `${help.summary}.`,
      '',
      ...help.notes,
      '',
      'Options:',
      formatRows([...help.rows, ...TARGETING_ROWS]),
      ''
    ].join('\n');
  }

  const shortcuts = Object.entries(SHORTCUT_HELP).filter(([shortcut]) => shortcut.startsWith(`${namespace} `));

  return [
    `Usage: arcanum config ${namespace} <shortcut> [options]`,
    '',
    'Shortcuts:',
    formatRows(shortcuts.map(([, help]) => [help.synopsis, help.summary])),
    '',
    `Run 'arcanum config ${namespace} <shortcut> --help' for a shortcut's usage.`,
    ''
  ].join('\n');
}

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
    ...(help.notes ? [...help.notes, ''] : []),
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
