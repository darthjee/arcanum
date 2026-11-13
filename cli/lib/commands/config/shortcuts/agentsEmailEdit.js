// `arcanum config agents email edit` (see
// docs/agents/architecture/arcanum-cli.md#agents-email): an interactive
// loop over the per-tier matrix. Each round shows the matrix, asks an
// agent (or `default` for `git.email`), an email (or `-` to unset) and
// a tier, confirms, then writes through the same path as `agents email
// set`/`unset`. An empty agent answer finishes. No lock is held while a
// question is open: each confirmed answer is one independent write.

import { lockTimeoutMs } from '../../../args.js';
import { EXIT_OK, UsageError } from '../../../exitCodes.js';
import { reportError } from '../../../output.js';
import { Interrupted, createPrompter, isInteractive, onceOnly } from '../../../prompter.js';
import { TIERS } from '../../../tierFiles.js';
import { EXIT_SIGINT } from '../../../writeTier.js';
import { UNSET_ANSWER, askTier, confirm } from '../setup/setting.js';
import { EMAIL_KEY, NAME, STRING_VALUE, agentKey } from './agentsEmailRead.js';
import { matrixText, readMatrix } from './agentsEmailMatrix.js';
import { checkMaxArity, checkShortcutFlags, delegate, memoizeTargets, writeValue } from './common.js';
import { defaultTier } from './defaultTier.js';

/** The agent answer that targets `git.email`. */
export const DEFAULT_AGENT = 'default';

/**
 * Runs the editor: the usage checks, the terminal check, then the loop.
 * @param {object} context - the `config` context (`values`, `io`,
 *   `output`, `deps`, `resolveTargets`, `warn`).
 * @param {string[]} args - the positionals after `edit` (none allowed).
 * @returns {Promise<number>} the exit code: `0` when finished, `130`
 *   when interrupted at a prompt.
 * @throws {UsageError} on a positional, a refused flag or no terminal.
 */
export async function editEmails(context, args) {
  const { values, io, deps = {} } = context;

  checkMaxArity(`${NAME} edit`, args, 0);
  checkEditFlags(values);

  if (!isInteractive(io, deps)) {
    throw new UsageError(`config ${NAME} edit needs an interactive terminal`, {
      hint: `use arcanum config ${NAME} set/unset instead`
    });
  }

  const prompter = deps.prompter || createPrompter({
    input: io.stdin, output: io.stderr, ...(deps.signals ? { signals: deps.signals } : {})
  });
  const session = {
    io,
    prompter,
    context: { ...context, resolveTargets: memoizeTargets(context.resolveTargets), warn: onceOnly(context.warn) }
  };

  try {
    return await loop(session);
  } finally {
    if (typeof prompter.close === 'function') {
      prompter.close();
    }
  }
}

/**
 * `edit` asks everything: it takes no `--json`, `--all-tiers`,
 * `--unset`, `--force`, `--string` or tier flag; `--lock-timeout` is
 * checked here and used by each write.
 * @param {object} values - the parsed flags.
 * @throws {UsageError} on any of those flags.
 */
function checkEditFlags(values) {
  const name = `${NAME} edit`;

  if (values.json) {
    throw new UsageError(`--json is not accepted by ${name}: it is interactive`);
  }

  if (values.unset) {
    throw new UsageError(`--unset is not accepted by ${name}; answer ${UNSET_ANSWER} to the email question`);
  }

  const tier = checkShortcutFlags(name, values, { write: true });

  if (tier !== undefined) {
    throw new UsageError(`--${tier} is not accepted by ${name}: it asks the tier`);
  }

  lockTimeoutMs(values['lock-timeout']);
}

/**
 * The rounds: matrix, agent, email, tier, confirm, write; until an empty
 * agent answer, or an interrupt at a prompt.
 * @param {object} session - the editor's state.
 * @returns {Promise<number>} the exit code.
 */
async function loop(session) {
  try {
    for (;;) {
      const matrix = await readMatrix(session.context);

      session.io.stderr.write(`\n${matrixText(matrix)}\n\n`);

      const agent = await askAgent(session, matrix);

      if (agent === null) {
        return EXIT_OK;
      }

      await editOne(session, matrix, agent);
    }
  } catch (error) {
    if (!(error instanceof Interrupted)) {
      throw error;
    }

    session.io.stderr.write('\n');

    return EXIT_SIGINT;
  }
}

/**
 * Asks which row to edit until the answer is a listed agent, `default`
 * or empty.
 * @param {object} session - the editor's state.
 * @param {object} matrix - the matrix shown.
 * @returns {Promise<(string|null)>} the agent (`default` for
 *   `git.email`), or `null` to finish.
 */
async function askAgent(session, matrix) {
  const choices = [...matrix.agents.map((row) => row.agent), DEFAULT_AGENT];

  for (;;) {
    const answer = (await session.prompter.ask(`agent [${choices.join('/')}] (Enter to finish): `)).trim();

    if (answer === '') {
      return null;
    }

    if (choices.includes(answer)) {
      return answer;
    }

    reportError(session.io, new UsageError(`unknown agent '${answer}': answer one of ${choices.join(', ')}`, {
      hint: `use arcanum config ${NAME} set <agent> <email> for other agents`
    }));
  }
}

/**
 * Asks the email until non-empty.
 * @param {object} session - the editor's state.
 * @returns {Promise<string>} the email as typed (trimmed), or `-`.
 */
async function askEmail(session) {
  for (;;) {
    const answer = (await session.prompter.ask(`  email (${UNSET_ANSWER} unsets): `)).trim();

    if (answer !== '') {
      return answer;
    }

    session.io.stderr.write(`arcanum: type an email, or ${UNSET_ANSWER} to unset\n`);
  }
}

/**
 * One round after the agent: email, tier, confirm, write. A declined
 * confirmation writes nothing; a failed write is reported and the loop
 * goes on.
 * @param {object} session - the editor's state.
 * @param {object} matrix - the matrix shown.
 * @param {string} agent - the agent, or `default`.
 * @returns {Promise<void>} resolves once written, declined or failed.
 * @throws {Interrupted} when interrupted at a prompt (a Ctrl-C during a
 *   write is handled by the write itself, which exits `130`).
 */
async function editOne(session, matrix, agent) {
  const key = agent === DEFAULT_AGENT ? EMAIL_KEY : agentKey(agent);
  const email = await askEmail(session);
  const tiers = TIERS.filter((tier) => matrix.files[tier] !== null);

  if (tiers.length === 0) {
    session.io.stderr.write('arcanum: no tier to write to (no repo and no claude config dir); nothing written\n');

    return;
  }

  const tier = await askTier(session, { entry: { tiers }, defaultTier: defaultTier(key, session.context.registry) });
  const where = `${tier} (${matrix.files[tier]})`;
  const question = email === UNSET_ANSWER
    ? `  unset ${key} at ${where}? [Y/n] `
    : `  write ${key} = ${email} to ${where}? [Y/n] `;

  if (!await confirm(session, question)) {
    session.io.stderr.write('  nothing written\n');

    return;
  }

  try {
    if (email === UNSET_ANSWER) {
      await delegate(session.context, 'unset', [key], tier);
    } else {
      await writeValue(session.context, { key, raw: email, tier, parseValue: STRING_VALUE });
    }
  } catch (error) {
    reportError(session.io, error);
  }
}
