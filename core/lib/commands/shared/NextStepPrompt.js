import { stat } from 'node:fs/promises';
import path from 'node:path';
import ConfigChain from '../../shared/config/ConfigChain.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import TtyPrompt from '../../utils/io/TtyPrompt.js';

const USAGE = 'Usage: next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... ' +
  '[--auto-key <skill>] [--no-prompt]';
const DEFAULT_TTY_DEVICE = '/dev/tty';
const VALUE_FLAGS = ['--repo', '--command', '--auto-key'];
const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_CHAT = 3;
const EXIT_NO_TTY = 4;
const ANSWERS = {
  y: 'yes',
  yes: 'yes',
  n: 'no',
  no: 'no',
  c: 'chat',
  chat: 'chat'
};

/**
 * Raised while parsing/validating the arguments; carries the stderr
 * message so `#evaluate` can turn it into an exit-`1` result.
 */
class UsageError extends Error {}

/**
 * Native `next-step-prompt` (`arcanum/_lib/next_step_prompt.sh`): the
 * interactive next-step offer shown by interactive issue skills after
 * their closing report. Byte-for-byte port of
 * `arcanum/_lib/next_step_prompt_shell.sh` — see
 * docs/agents/architecture/skill-finish.md for the stdout/exit-code
 * contract (auto mode `CHOICE=yes`/`AUTO=true`, followed by
 * `CLEAR=true` when `next_step.clear.<skill>` is also `true`, `--no-prompt`
 * `CHOICE=no`, the `/dev/tty` prompt with exits `0`/`3`, the
 * `FALLBACK=chat` + `COMMAND=` exit-`4` fallback, and exit `1` with
 * nothing on stdout on usage errors). Status `host-only`, so it always
 * runs on the host and keeps the real `/dev/tty`.
 *
 * `#evaluate` holds the whole decision and returns its outcome instead
 * of printing it, so other native commands (e.g.
 * `AutoPlanIssueAutoNext`) reuse it in-process rather than shelling out
 * to the shim.
 */
class NextStepPrompt {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {object} [deps.env] - the environment (`ARCANUM_TTY_DEVICE`,
   *   and `CLAUDE_CONFIG_DIR`/`HOME` for the global config tier).
   * @param {ConfigChain} [deps.configChain] - the 3-tier config reader.
   * @param {(device: string) => TtyPrompt} [deps.ttyFactory] - builds the
   *   prompt over the given terminal device.
   * @param {{write: (chunk: string) => boolean}} [deps.stderr] - where the
   *   stderr lines go when run as a CLI command.
   */
  constructor({
    env = process.env,
    configChain = new ConfigChain({ env }),
    ttyFactory = (device) => new TtyPrompt({ device }),
    stderr = process.stderr
  } = {}) {
    this._env = env;
    this._configChain = configChain;
    this._ttyFactory = ttyFactory;
    this._stderr = stderr;
  }

  /**
   * CLI entrypoint: evaluates the offer, writes its stderr lines, and
   * maps its exit code onto the dispatch contract.
   * @param {...string} args - `--repo <path> --command <cmd>...
   *   [--auto-key <skill>] [--no-prompt]`.
   * @returns {Promise<string>} the stdout lines (exit `0`).
   * @throws {DispatchFailure} with the stdout lines and the exit code
   *   (`1`, `3` or `4`) on every non-zero outcome.
   */
  async run(...args) {
    const { stdout, stderr, exitCode } = await this.evaluate(args);

    if (stderr) {
      this._stderr.write(stderr);
    }

    if (exitCode !== EXIT_OK) {
      throw new DispatchFailure(stdout, exitCode);
    }

    return stdout;
  }

  /**
   * Runs the whole offer — validation, auto mode, `--no-prompt`, then
   * the TTY prompt or its fallback — without printing anything itself.
   * @param {string[]} args - the raw flags.
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   *   the outcome.
   */
  async evaluate(args) {
    let options;

    try {
      options = await this.parseArgs(args);
    } catch (error) {
      if (error instanceof UsageError) {
        return this.outcome('', `Error: ${error.message}\n${USAGE}\n`, EXIT_ERROR);
      }

      throw error;
    }

    if (await this.autoEnabled(options)) {
      return this.autoOutcome(options, await this.clearEnabled(options));
    }

    if (options.noPrompt) {
      return this.outcome('CHOICE=no\n', '', EXIT_OK);
    }

    return this.prompt(options.commands);
  }

  /**
   * Parses and validates the flags, exactly like the shell twin: every
   * flag error comes before the `--repo`/`--command` presence checks.
   * @param {string[]} args - the raw flags.
   * @returns {Promise<{repoPath: string, commands: string[], autoKey: (string|null), noPrompt: boolean}>}
   *   the parsed options.
   * @throws {UsageError} on any usage error.
   */
  async parseArgs(args) {
    const options = { repoPath: '', commands: [], autoKey: null, noPrompt: false };
    let index = 0;

    while (index < args.length) {
      const flag = args[index];

      if (flag === '--no-prompt') {
        options.noPrompt = true;
        index += 1;
      } else if (VALUE_FLAGS.includes(flag)) {
        if (index + 1 >= args.length) {
          throw new UsageError(`${flag} requires a value`);
        }

        this.assignValue(options, flag, args[index + 1]);
        index += 2;
      } else {
        throw new UsageError(`unknown argument '${flag}'`);
      }
    }

    await this.validate(options);

    return options;
  }

  /**
   * @param {object} options - the options being built.
   * @param {string} flag - `--repo`, `--command` or `--auto-key`.
   * @param {string} value - the flag's value.
   * @returns {void}
   * @throws {UsageError} on an empty `--command`/`--auto-key` value.
   */
  assignValue(options, flag, value) {
    if (flag === '--repo') {
      options.repoPath = value;
      return;
    }

    if (value === '') {
      throw new UsageError(`${flag} must not be empty`);
    }

    if (flag === '--command') {
      options.commands.push(value);
    } else {
      options.autoKey = value;
    }
  }

  /**
   * @param {{repoPath: string, commands: string[]}} options - the parsed
   *   options.
   * @returns {Promise<void>} resolves when they are valid.
   * @throws {UsageError} on a missing or non-directory `--repo`, or no
   *   `--command`.
   */
  async validate({ repoPath, commands }) {
    if (!repoPath) {
      throw new UsageError('--repo is required');
    }

    if (!(await this.isDirectory(repoPath))) {
      throw new UsageError(`--repo '${repoPath}' is not a directory`);
    }

    if (commands.length === 0) {
      throw new UsageError('at least one --command is required');
    }
  }

  /**
   * @param {string} target - a path.
   * @returns {Promise<boolean>} whether it is (or links to) a directory.
   */
  async isDirectory(target) {
    try {
      return (await stat(target)).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Reads `next_step.auto.<skill>` through the config chain, with the
   * local/repo tiers resolved under `--repo`. Only the JSON value `true`
   * enables auto mode; any read failure means "disabled".
   * @param {{repoPath: string, autoKey: (string|null)}} options - the
   *   parsed options.
   * @returns {Promise<boolean>} whether auto mode fires.
   */
  async autoEnabled({ repoPath, autoKey }) {
    if (autoKey === null) {
      return false;
    }

    try {
      return (await this._configChain.read(path.resolve(repoPath), 'next_step', `auto.${autoKey}`)) === true;
    } catch {
      return false;
    }
  }

  /**
   * Reads `next_step.clear.<skill>` through the config chain, with the
   * local/repo tiers resolved under `--repo`. Only called once auto mode
   * fired. Only the JSON value `true` enables it; any read failure means
   * "disabled" and keeps the plain auto result.
   * @param {{repoPath: string, autoKey: string}} options - the parsed
   *   options.
   * @returns {Promise<boolean>} whether `CLEAR=true` is reported.
   */
  async clearEnabled({ repoPath, autoKey }) {
    try {
      return (await this._configChain.read(path.resolve(repoPath), 'next_step', `clear.${autoKey}`)) === true;
    } catch {
      return false;
    }
  }

  /**
   * @param {{commands: string[], autoKey: string}} options - the parsed
   *   options.
   * @param {boolean} clear - whether `next_step.clear.<skill>` is `true`.
   * @returns {{stdout: string, stderr: string, exitCode: number}} the
   *   auto-mode outcome: `CHOICE=yes`/`AUTO=true` (plus `CLEAR=true`)
   *   and the `auto-continuing:` notice naming the enabled keys.
   */
  autoOutcome({ commands, autoKey }, clear) {
    const keys = clear
      ? `next_step.auto.${autoKey}=true, next_step.clear.${autoKey}=true`
      : `next_step.auto.${autoKey}=true`;
    const stdout = clear ? 'CHOICE=yes\nAUTO=true\nCLEAR=true\n' : 'CHOICE=yes\nAUTO=true\n';

    return this.outcome(stdout, `auto-continuing: ${commands[0]} (${keys})\n`, EXIT_OK);
  }

  /**
   * Prompts on the terminal, or falls back to `FALLBACK=chat` when it
   * cannot be opened.
   * @param {string[]} commands - the offered commands.
   * @returns {{stdout: string, stderr: string, exitCode: number}} the
   *   outcome.
   */
  prompt(commands) {
    const device = this._env.ARCANUM_TTY_DEVICE || DEFAULT_TTY_DEVICE;
    const tty = this._ttyFactory(device);

    if (!tty.open()) {
      const lines = commands.map((command) => `COMMAND=${command}\n`).join('');

      return this.outcome(`FALLBACK=chat\n${lines}`, '', EXIT_NO_TTY);
    }

    let choice;

    try {
      tty.write(this.offer(commands));
      choice = tty.ask('Run it now? [Y]es / [N]o / [C]hat: ', (answer) => this.parseAnswer(answer));
    } finally {
      tty.close();
    }

    return this.choiceOutcome(choice, device);
  }

  /**
   * @param {string[]} commands - the offered commands.
   * @returns {string} the `Next step:` / `Next steps:` block.
   */
  offer(commands) {
    if (commands.length === 1) {
      return `Next step: ${commands[0]}\n`;
    }

    return `Next steps:\n${commands.map((command) => `  ${command}\n`).join('')}`;
  }

  /**
   * @param {string} answer - one line read from the terminal.
   * @returns {('yes'|'no'|'chat'|undefined)} the choice, or `undefined`
   *   to re-prompt. Whitespace is dropped and case ignored, like the
   *   shell's `tr` pipeline.
   */
  parseAnswer(answer) {
    return ANSWERS[answer.replace(/\s/g, '').toLowerCase()];
  }

  /**
   * @param {('yes'|'no'|'chat'|null)} choice - the answer, or `null` at
   *   EOF.
   * @param {string} device - the terminal device path.
   * @returns {{stdout: string, stderr: string, exitCode: number}} the
   *   outcome.
   */
  choiceOutcome(choice, device) {
    if (choice === null) {
      return this.outcome('', `Error: ${device} closed before a valid answer was given.\n`, EXIT_ERROR);
    }

    if (choice === 'chat') {
      return this.outcome('CHOICE=chat\nCHAT_CONTEXT=next_step\n', '', EXIT_CHAT);
    }

    return this.outcome(`CHOICE=${choice}\n`, '', EXIT_OK);
  }

  /**
   * @param {string} stdout - the stdout lines.
   * @param {string} stderr - the stderr lines.
   * @param {number} exitCode - the exit code.
   * @returns {{stdout: string, stderr: string, exitCode: number}} the
   *   outcome.
   */
  outcome(stdout, stderr, exitCode) {
    return { stdout, stderr, exitCode };
  }
}

export default NextStepPrompt;
