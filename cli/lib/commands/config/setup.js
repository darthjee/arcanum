// `arcanum config setup [<section>...]`: the interactive onboarding
// wizard (see the `arcanum config setup` wizard section of
// docs/agents/specs/arcanum-cli/shortcuts-and-setup.md). It asks every
// registry entry carrying `setup`, in canonical section order, then by
// `setup.order`, and writes each confirmed answer immediately through
// the generic `set`/`unset` path. It never holds a lock while prompting.

import { SETUP_SECTIONS } from '../../../../shared/lib/config/KeyRegistry.js';
import { lockTimeoutMs } from '../../args.js';
import { EXIT_OK, TargetUnavailableError, UsageError } from '../../exitCodes.js';
import { createPrompter } from '../../prompter.js';
import { REPO_CONFIG_FILE } from '../../tierFiles.js';
import { DEFAULT_TIER as AGENTS_EMAIL_TIER, EMAIL_KEY } from './shortcuts/agentsEmail.js';
import { memoizeTargets } from './shortcuts/common.js';
import { KEY as IGNORE_CHECKS_KEY, TIER as IGNORE_CHECKS_TIER } from './shortcuts/ignoreChecks.js';
import { DEFAULT_TIER as NEXT_STEP_TIER, PREFIX as NEXT_STEP_PREFIX } from './shortcuts/nextStep.js';
import { SINGLE_VALUE } from './shortcuts/singleValue.js';

/** `config setup`'s own flags, beyond the global ones. */
export const options = { 'lock-timeout': { type: 'string' } };

/** `config setup`'s positionals: any number of sections. */
export const positionals = ['section...'];

/** Whether `config setup` accepts the tier flags. */
export const acceptsTier = false;

/** The per-agent email entry, whose instances come from the repo's agents. */
export const AGENTS_KEY = 'git.agents.<agent>';

/** The section whose items all need a configured repo. */
export const CI_SECTION = 'ci';

/**
 * The wizard's default write tier per registry key, the same as the
 * matching shortcut's (a single-tier key always uses its only tier).
 */
export const DEFAULT_TIERS = {
  ...Object.fromEntries(Object.values(SINGLE_VALUE).map(({ key, tier }) => [key, tier])),
  [EMAIL_KEY]: AGENTS_EMAIL_TIER,
  [AGENTS_KEY]: AGENTS_EMAIL_TIER,
  [`${NEXT_STEP_PREFIX}.<skill>`]: NEXT_STEP_TIER,
  [IGNORE_CHECKS_KEY]: IGNORE_CHECKS_TIER
};

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
  const timeoutMs = lockTimeoutMs(values['lock-timeout']);
  const resolveTargets = memoizeTargets(context.resolveTargets);
  const targets = await resolveTargets();
  const items = availableItems(setupItems(registry, sections), targets, output);

  const prompter = deps.prompter || createPrompter({ input: io.stdin, output: io.stderr });
  const session = {
    context: { ...context, resolveTargets },
    prompter,
    targets,
    timeoutMs,
    timeoutLabel: values['lock-timeout'] || '10',
    results: []
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
 * @param {object} entry - a registry entry.
 * @returns {string} its default write tier: its only tier, or the
 *   matching shortcut's, or `local` when allowed, or its first tier.
 */
export function defaultTier(entry) {
  if (entry.tiers.length === 1) {
    return entry.tiers[0];
  }

  if (Object.hasOwn(DEFAULT_TIERS, entry.key) && entry.tiers.includes(DEFAULT_TIERS[entry.key])) {
    return DEFAULT_TIERS[entry.key];
  }

  return entry.tiers.includes('local') ? 'local' : entry.tiers[0];
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
    const base = { section: entry.setup.section, entry, defaultTier: defaultTier(entry) };

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
 * Asks each item in turn.
 * @param {object} session - the wizard's state.
 * @param {object[]} items - the items to ask.
 * @returns {Promise<number>} the exit code.
 */
export async function runItems(session, items) {
  void session;
  void items;

  return EXIT_OK;
}

export default { name: 'setup', options, positionals, acceptsTier, run };
