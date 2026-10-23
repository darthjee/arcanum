// `arcanum config setup [<section>...]`: the interactive onboarding
// wizard (see the `arcanum config setup` wizard section of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md). It asks every
// registry entry carrying `setup`, in canonical section order, then by
// `setup.order`, and writes each confirmed answer immediately through
// the generic `set`/`unset` path. It never holds a lock while prompting.

import { SETUP_SECTIONS } from '../../../../shared/lib/config/KeyRegistry.js';
import { lockTimeoutMs } from '../../args.js';
import { EXIT_OK, TargetUnavailableError, UsageError } from '../../exitCodes.js';
import { EXIT_SIGINT } from '../../writeTier.js';
import { Interrupted, createPrompter } from '../../prompter.js';
import { REPO_CONFIG_FILE } from '../../tierFiles.js';
import { askPatterns } from './setup/ci.js';
import { askAgents } from './setup/identity.js';
import { askSetting } from './setup/setting.js';
import { printSummary } from './setup/summary.js';
import { AGENTS_PATTERN } from './shortcuts/agentsEmail.js';
import { memoizeTargets } from './shortcuts/common.js';
import { defaultTier } from './shortcuts/defaultTier.js';

/** `config setup`'s own flags, beyond the global ones. */
export const options = { 'lock-timeout': { type: 'string' } };

/** `config setup`'s positionals: any number of sections. */
export const positionals = ['section...'];

/** Whether `config setup` accepts the tier flags. */
export const acceptsTier = false;

/** The per-agent email entry, whose instances come from the repo's agents. */
export const AGENTS_KEY = AGENTS_PATTERN;

/** The section whose items all need a configured repo. */
export const CI_SECTION = 'ci';

const WILDCARD = /^<[^>]+>$/;

/**
 * Runs the wizard: the usage checks (`--json`, the terminal, the
 * sections), then the item selection and targeting, then each item.
 * @param {object} context - the subcommand context.
 * @param {string[]} context.args - the sections asked for.
 * @param {object} context.values - the parsed flags.
 * @param {object} context.io - the streams (`stdin`, `stderr`).
 * @param {object} context.output - the output helpers.
 * @param {object} context.registry - the key registry.
 * @param {object} context.deps - injectable collaborators: `prompter`,
 *   `isInteractive`, `lock`, `signals`.
 * @returns {Promise<number>} the exit code.
 * @throws {UsageError} on `--json`, no terminal, or an unknown section.
 * @throws {TargetUnavailableError} when every requested item is skipped.
 */
export async function run(context) {
  const { args, values, io, output, registry, deps = {} } = context;

  if (values.json) {
    throw new UsageError('--json is not accepted by setup: it is interactive');
  }

  if (!isInteractive(io, deps)) {
    throw new UsageError('config setup needs an interactive terminal', {
      hint: 'use arcanum config set / the shortcuts instead'
    });
  }

  const sections = selectSections(args);

  lockTimeoutMs(values['lock-timeout']);

  const resolveTargets = memoizeTargets(context.resolveTargets);
  const targets = await resolveTargets();
  const items = availableItems(setupItems(registry, sections), targets, output);

  const baseSignals = deps.signals || processSignals();
  const prompter = deps.prompter || createPrompter({ input: io.stdin, output: io.stderr, signals: baseSignals });
  const session = { io, output, registry, prompter, targets, items, results: [], summarized: false };

  session.context = {
    ...context,
    resolveTargets,
    warn: onceOnly(context.warn),
    deps: { ...deps, signals: summarizingSignals(session, baseSignals) }
  };

  try {
    return await runItems(session, items);
  } finally {
    if (typeof prompter.close === 'function') {
      prompter.close();
    }
  }
}

/**
 * @returns {{on: (signal: string, handler: () => void) => void, off: (signal: string, handler: () => void) => void, exit: (code: number) => void}}
 *   the real process's signal hooks.
 */
function processSignals() {
  return {
    on: (signal, handler) => process.on(signal, handler),
    off: (signal, handler) => process.off(signal, handler),
    exit: (code) => process.exit(code)
  };
}

/**
 * The signal hooks the wizard's writes run with: a Ctrl-C during a
 * write still releases the lock and exits `130` (`writeKey`), but
 * prints the summary first.
 * @param {object} session - the wizard's state.
 * @param {object} signals - the underlying hooks.
 * @returns {object} the hooks.
 */
export function summarizingSignals(session, signals) {
  return {
    on: (signal, handler) => signals.on(signal, handler),
    off: (signal, handler) => signals.off(signal, handler),
    exit: (code) => {
      printSummary(session, true);
      signals.exit(code);
    }
  };
}

/**
 * @param {object} io - the streams.
 * @param {object} deps - injectable collaborators (`isInteractive`).
 * @returns {boolean} whether stdin and stderr are both terminals, or the
 *   injected answer.
 */
export function isInteractive(io, deps) {
  if (deps.isInteractive !== undefined) {
    return Boolean(deps.isInteractive);
  }

  return Boolean(io.stdin && io.stdin.isTTY && io.stderr && io.stderr.isTTY);
}

/**
 * @param {string[]} args - the sections as typed.
 * @returns {string[]} the sections to run, deduplicated and in canonical
 *   order; every section when none is given.
 * @throws {UsageError} on an unknown section, listing the valid ones.
 */
export function selectSections(args) {
  for (const section of args) {
    if (!SETUP_SECTIONS.includes(section)) {
      throw new UsageError(`unknown setup section '${section}'`, { hint: `sections: ${SETUP_SECTIONS.join(', ')}` });
    }
  }

  return args.length === 0 ? [...SETUP_SECTIONS] : SETUP_SECTIONS.filter((section) => args.includes(section));
}

/**
 * Builds the wizard's items for the given sections: every entry carrying
 * `setup`, by section, then by `setup.order`, with a wildcard entry's
 * `setup.instances` expanded into one item each. The per-agent entry
 * stays a single `agents` item, expanded once the repo's agents are known.
 * @param {object} registry - the key registry.
 * @param {string[]} sections - the sections to run.
 * @returns {object[]} the items, each with its `section`, `key`,
 *   `entry`, `kind` (`value`, `array` or `agents`) and `defaultTier`.
 */
export function setupItems(registry, sections) {
  const entries = registry.entries()
    .filter((entry) => entry.setup && sections.includes(entry.setup.section))
    .sort((a, b) => (
      (SETUP_SECTIONS.indexOf(a.setup.section) - SETUP_SECTIONS.indexOf(b.setup.section)) || (a.setup.order - b.setup.order)
    ));

  return entries.flatMap((entry) => {
    const base = { section: entry.setup.section, entry, defaultTier: defaultTier(entry.key, registry) };

    if (entry.key === AGENTS_KEY) {
      return [{ ...base, key: entry.key, kind: 'agents' }];
    }

    const kind = entry.type === 'array' ? 'array' : 'value';

    if (!entry.key.split('.').some((segment) => WILDCARD.test(segment))) {
      return [{ ...base, key: entry.key, kind }];
    }

    return (entry.setup.instances || []).map((instance) => ({
      ...base,
      key: entry.key.split('.').map((segment) => (WILDCARD.test(segment) ? instance : segment)).join('.'),
      kind
    }));
  });
}

/**
 * @param {object} item - a wizard item.
 * @returns {boolean} whether it needs a configured repo: the per-agent
 *   item, the `ci` section, and every item defaulting to `repo` or `local`.
 */
export function needsRepo(item) {
  return item.kind === 'agents' || item.section === CI_SECTION || item.defaultTier !== 'global';
}

/**
 * Drops the repo-dependent items when there is no configured repo,
 * printing one note per section affected (and the `/init-claude` hint
 * for an unconfigured repo).
 * @param {object[]} items - the wizard items.
 * @param {{repo: object}} targets - the resolved targets.
 * @param {object} output - the output helpers.
 * @returns {object[]} the items left to ask.
 * @throws {TargetUnavailableError} when none is left.
 */
export function availableItems(items, { repo }, output) {
  if (repo.root !== null && repo.configured) {
    return items;
  }

  const reason = repo.root === null
    ? `no repo at ${repo.path}`
    : `${repo.root} is not arcanum-configured (no ${REPO_CONFIG_FILE})`;
  const hint = repo.root === null ? null : `run /init-claude in ${repo.root}`;
  const kept = items.filter((item) => !needsRepo(item));

  for (const section of SETUP_SECTIONS) {
    const inSection = items.filter((item) => item.section === section);
    const skipped = inSection.filter(needsRepo);

    if (skipped.length === 0) {
      continue;
    }

    if (skipped.length === inSection.length) {
      output.note(`skipping the ${section} section: ${reason}`);
    } else {
      output.note(`skipping ${[...new Set(skipped.map((item) => item.entry.key))].join(', ')} (${section}): ${reason}`);
    }
  }

  if (kept.length === 0) {
    throw new TargetUnavailableError(`nothing to set up: every requested setting needs a configured repo (${reason})`, {
      hint
    });
  }

  if (hint !== null) {
    output.note(hint);
  }

  return kept;
}

/**
 * @param {(message: string) => void} warn - prints a stderr warning.
 * @returns {(message: string) => void} the same, printing each distinct
 *   message once, so re-reading the tiers per setting does not repeat
 *   the read warnings.
 */
export function onceOnly(warn) {
  const seen = new Set();

  return (message) => {
    if (!seen.has(message)) {
      seen.add(message);
      warn(message);
    }
  };
}

/** Item kind → its dialogue. */
const ASKERS = { value: askSetting, agents: askAgents, array: askPatterns };

/**
 * Asks each item in turn.
 * @param {object} session - the wizard's state.
 * @param {object[]} items - the items to ask.
 * @returns {Promise<number>} the exit code: the first failed write's,
 *   `130` when interrupted, else `0`.
 */
export async function runItems(session, items) {
  let finished = false;

  try {
    for (const item of items) {
      await ASKERS[item.kind](session, item);
    }

    finished = true;
  } catch (error) {
    if (!(error instanceof Interrupted)) {
      throw error;
    }

    return EXIT_SIGINT;
  } finally {
    printSummary(session, !finished);
  }

  const failed = session.results.find((result) => result.status === 'failed');

  return failed ? failed.exit : EXIT_OK;
}

export default { name: 'setup', options, positionals, acceptsTier, run };
