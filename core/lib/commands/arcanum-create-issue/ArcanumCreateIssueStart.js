import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import TtyPrompt from '../../utils/io/TtyPrompt.js';
import DraftStore from './DraftStore.js';
import GithubPreflight from './GithubPreflight.js';

const USAGE = 'Usage: start.sh <repo_path> [--new | --resume <draft>]';
const EXIT_ERROR = 1;
const EXIT_INVALID = 2;
const EXIT_NO_TTY = 4;
const AGE_UNITS = [
  { seconds: 86400, suffix: 'd' },
  { seconds: 3600, suffix: 'h' },
  { seconds: 60, suffix: 'm' }
];

/**
 * Native-only `arcanum-create-issue-start` (`/arcanum-create-issue`'s
 * `scripts/start.sh`): runs the GitHub preflight, then creates a new
 * draft or resumes an existing one — prompting on `/dev/tty` when drafts
 * exist and no `--new`/`--resume` flag was given, or falling back to
 * exit `4` with one `DRAFT=` line per draft when there is no TTY. See
 * the "`arcanum-create-issue-start`" section of
 * docs/agents/specs/arcanum-create-issue.md for the output/exit-code
 * contract.
 */
class ArcanumCreateIssueStart {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (`repoPath`, `resolve`, `getToken`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {DraftStore} [deps.draftStore] - the drafts store.
   * @param {TtyPrompt} [deps.tty] - the `/dev/tty` prompt.
   * @param {GithubPreflight} [deps.preflight] - the GitHub preflight.
   * @param {() => Date} [deps.now] - clock, for draft ages.
   */
  constructor(repoContext, {
    now = () => new Date(),
    draftStore = new DraftStore({ repoPath: repoContext.repoPath, now }),
    tty = new TtyPrompt(),
    preflight = new GithubPreflight(repoContext)
  } = {}) {
    this._repoContext = repoContext;
    this._draftStore = draftStore;
    this._tty = tty;
    this._preflight = preflight;
    this._now = now;
  }

  /**
   * @param {...string} args - `[--new | --resume <draft>]`.
   * @returns {Promise<string>} `STATUS=new|resumed` and `FILE=<path>`
   *   lines (exit `0`).
   * @throws {DispatchFailure} exit `2` (`ERROR=`) on invalid arguments or
   *   an unknown `--resume` draft; exit `1` (`STATUS=error`, `ERROR=`) on
   *   a failed preflight; exit `4` (`FALLBACK=chat` plus `DRAFT=` lines)
   *   when drafts exist and `/dev/tty` cannot be opened.
   */
  async run(...args) {
    const mode = this.parseArgs(args);
    const resumeFile = mode.resume === undefined ? null : await this.resolveResume(mode.resume);

    await this.runPreflight();

    if (resumeFile) {
      return this.result('resumed', resumeFile);
    }

    if (mode.fresh) {
      return this.result('new', await this._draftStore.create());
    }

    const drafts = await this._draftStore.list();

    if (drafts.length === 0) {
      return this.result('new', await this._draftStore.create());
    }

    return this.chooseDraft(drafts);
  }

  /**
   * @param {string[]} args - the raw arguments.
   * @returns {{fresh: boolean, resume: (string|undefined)}} the parsed
   *   mode.
   * @throws {DispatchFailure} exit `2` on anything but no arguments,
   *   `--new`, or `--resume <draft>`.
   */
  parseArgs(args) {
    if (args.length === 0) {
      return { fresh: false, resume: undefined };
    }

    if (args.length === 1 && args[0] === '--new') {
      return { fresh: true, resume: undefined };
    }

    if (args.length === 2 && args[0] === '--resume' && args[1]) {
      return { fresh: false, resume: args[1] };
    }

    throw new DispatchFailure(`ERROR=${USAGE}\n`, EXIT_INVALID);
  }

  /**
   * @param {string} draft - the `--resume` argument.
   * @returns {Promise<string>} the draft's absolute path.
   * @throws {DispatchFailure} exit `2` when it is not a known draft.
   */
  async resolveResume(draft) {
    const file = await this._draftStore.resolve(draft, this._repoContext.repoPath);

    if (!file) {
      throw new DispatchFailure(`ERROR=unknown draft: ${draft}\n`, EXIT_INVALID);
    }

    return file;
  }

  /**
   * @returns {Promise<void>} resolves when the preflight passes.
   * @throws {DispatchFailure} exit `1` with `STATUS=error` and `ERROR=`.
   */
  async runPreflight() {
    try {
      await this._preflight.check();
    } catch (error) {
      throw new DispatchFailure(`STATUS=error\nERROR=${error.message}\n`, EXIT_ERROR);
    }
  }

  /**
   * Prompt on `/dev/tty` for a draft to resume or a fresh start.
   * @param {Array<{path: string, timestamp: string, mtime: Date, title: string}>} drafts -
   *   the existing drafts, newest first.
   * @returns {Promise<string>} the `STATUS=`/`FILE=` output.
   * @throws {DispatchFailure} exit `4` when `/dev/tty` cannot be opened,
   *   or reaches EOF before a valid answer.
   */
  async chooseDraft(drafts) {
    if (!this._tty.open()) {
      throw this.noTtyFailure(drafts);
    }

    let choice;

    try {
      this._tty.write(this.draftMenu(drafts));
      choice = this._tty.ask('Resume a draft or start a new issue? [N]ew / <number>: ', (answer) =>
        this.parseChoice(answer, drafts)
      );
    } finally {
      this._tty.close();
    }

    if (choice === null) {
      throw this.noTtyFailure(drafts);
    }

    if (choice === 'new') {
      return this.result('new', await this._draftStore.create());
    }

    return this.result('resumed', choice.path);
  }

  /**
   * @param {string} answer - the trimmed TTY answer.
   * @param {Array<{path: string}>} drafts - the listed drafts.
   * @returns {'new'|{path: string}|undefined} `'new'`, the chosen draft,
   *   or `undefined` to re-ask.
   */
  parseChoice(answer, drafts) {
    if (/^(n|new)$/i.test(answer)) {
      return 'new';
    }

    if (/^\d+$/.test(answer)) {
      return drafts[Number(answer) - 1];
    }

    return undefined;
  }

  /**
   * @param {Array<{path: string, timestamp: string, mtime: Date, title: string}>} drafts -
   *   the existing drafts, newest first.
   * @returns {string} the numbered draft list written to `/dev/tty`.
   */
  draftMenu(drafts) {
    const lines = drafts.map((draft, index) =>
      `  [${index + 1}] ${draft.title || '(empty)'} (${draft.timestamp}, ${this.age(draft.mtime)} ago)\n` +
      `      ${draft.path}\n`
    );

    return `Unfinished issue drafts:\n${lines.join('')}`;
  }

  /**
   * @param {Date} mtime - a draft's last-modified time.
   * @returns {string} a compact age (`3d`, `5h`, `12m`, `40s`).
   */
  age(mtime) {
    const seconds = Math.max(0, Math.floor((this._now() - mtime) / 1000));
    const unit = AGE_UNITS.find(({ seconds: size }) => seconds >= size);

    return unit ? `${Math.floor(seconds / unit.seconds)}${unit.suffix}` : `${seconds}s`;
  }

  /**
   * @param {Array<{path: string, timestamp: string, title: string}>} drafts -
   *   the existing drafts, newest first.
   * @returns {DispatchFailure} the exit-`4` failure with `FALLBACK=chat`
   *   and one `DRAFT=<path>\t<timestamp>\t<title>` line per draft.
   */
  noTtyFailure(drafts) {
    const lines = drafts.map((draft) => `DRAFT=${draft.path}\t${draft.timestamp}\t${draft.title}\n`);

    return new DispatchFailure(`FALLBACK=chat\n${lines.join('')}`, EXIT_NO_TTY);
  }

  /**
   * @param {'new'|'resumed'} status - the outcome.
   * @param {string} file - the draft path.
   * @returns {string} the `STATUS=`/`FILE=` output.
   */
  result(status, file) {
    return `STATUS=${status}\nFILE=${file}\n`;
  }
}

export default ArcanumCreateIssueStart;
