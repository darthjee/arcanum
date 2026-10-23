// The `arcanum config` shortcut namespaces (see
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md#shortcut-set).
// A namespace is either a runner itself (`engine`) or a map of shortcut
// name → runner (`git safe-branch`, `auto-fix-all clear-context`, …).

import { UsageError } from '../../../exitCodes.js';
import { singleValue } from './singleValue.js';

/** Namespace → its runner, or its shortcuts (name → runner). */
export const SHORTCUTS = {
  engine: singleValue('engine'),
  git: {
    'safe-branch': singleValue('git safe-branch'),
    'merge-body': singleValue('git merge-body')
  },
  'auto-fix-all': {
    'clear-context': singleValue('auto-fix-all clear-context'),
    'finish-on-empty-queue': singleValue('auto-fix-all finish-on-empty-queue')
  },
  'monitor-issues': {
    'clear-context': singleValue('monitor-issues clear-context')
  }
};

/**
 * @param {(string|undefined)} name - the word after `config`.
 * @returns {boolean} whether it names a shortcut namespace.
 */
export function isShortcut(name) {
  return name !== undefined && Object.hasOwn(SHORTCUTS, name);
}

/**
 * Runs the shortcut the positionals name.
 * @param {object} context - the `config` context.
 * @param {string[]} context.positionals - the arguments after `config`,
 *   starting with the namespace.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on a missing or unknown shortcut.
 */
export function runShortcut(context) {
  const [namespace, ...rest] = context.positionals;
  const entry = SHORTCUTS[namespace];

  if (typeof entry === 'function') {
    return entry(context, rest);
  }

  const [name, ...args] = rest;

  if (name === undefined) {
    throw new UsageError(`config ${namespace} needs a shortcut: ${Object.keys(entry).join(', ')}`);
  }

  if (!Object.hasOwn(entry, name)) {
    throw new UsageError(`unknown config shortcut '${namespace} ${name}'`, {
      hint: `${namespace} shortcuts: ${Object.keys(entry).join(', ')}`
    });
  }

  return entry[name](context, args);
}
