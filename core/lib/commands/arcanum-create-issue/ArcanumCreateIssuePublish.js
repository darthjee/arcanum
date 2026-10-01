import GithubIssueService from '../../services/GithubIssueService.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import GitHubClient from '../../utils/github/GitHubClient.js';
import TtyPrompt from '../../utils/io/TtyPrompt.js';
import DraftStore from './DraftStore.js';
import IssueLabels from './IssueLabels.js';

const USAGE = 'Usage: publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...';
const CONFIRMED = '--confirmed';
const SHIPIT_CONFIRMED = '--shipit-confirmed';
const EXIT_FAILED = 1;
const EXIT_INVALID = 2;
const EXIT_NO_TTY = 4;
const CREATE_HINT = 'check GitHub before running again: the issue may have been created';

/**
 * Native-only `arcanum-create-issue-publish` (`/arcanum-create-issue`'s
 * `scripts/publish.sh`): validates the draft, title and labels, asks
 * prompt 5 (final confirmation) and prompt 6 (`shipit`) on `/dev/tty`
 * unless `--confirmed` / `--shipit-confirmed` are given, resolves the
 * labels against the repo's (creating missing ones), creates the issue
 * with every label in one REST call (no retry), and deletes the draft
 * only on success. See the "`arcanum-create-issue-publish`" section of
 * docs/agents/specs/arcanum-create-issue.md for the output/exit-code
 * contract; prompt 5's No/Chat answers print `STATUS=declined` plus
 * `CHOICE=no|chat` (exit `0`, nothing created).
 */
class ArcanumCreateIssuePublish {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (`repoPath`, origin/token resolution).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {DraftStore} [deps.draftStore] - the drafts store.
   * @param {TtyPrompt} [deps.tty] - the `/dev/tty` prompt.
   * @param {{listLabelNames: () => Promise<string[]>, createLabel: (name: string, color: string) => Promise<void>}} [deps.labelClient] -
   *   the repo's label client.
   * @param {GithubIssueService} [deps.issueService] - the issue creator.
   */
  constructor(repoContext, {
    draftStore = new DraftStore({ repoPath: repoContext.repoPath }),
    tty = new TtyPrompt(),
    labelClient = new GitHubClient({ context: repoContext }),
    issueService = new GithubIssueService({ repoContext })
  } = {}) {
    this._repoContext = repoContext;
    this._draftStore = draftStore;
    this._tty = tty;
    this._labels = new IssueLabels(labelClient);
    this._issueService = issueService;
  }

  /**
   * @param {...string} args - `<draft> "<title>" [--confirmed]
   *   [--shipit-confirmed] <label>...`.
   * @returns {Promise<string>} `STATUS=ok`, `ID=`, `URL=`, `LABELS=`,
   *   `EPIC=` and any `WARNING=` lines, or `STATUS=declined` plus
   *   `CHOICE=no|chat` when prompt 5 is answered No/Chat (exit `0`).
   * @throws {DispatchFailure} exit `2` (`ERROR=`) on invalid input; exit
   *   `4` (`FALLBACK=chat`) when a confirmation is needed and `/dev/tty`
   *   is unavailable; exit `1` (`STATUS=failed`, `ERROR=`) when the
   *   GitHub calls fail.
   */
  async run(...args) {
    const request = await this.parseArgs(args);
    const body = await this._draftStore.body(request.file);

    if (body === '') {
      throw this.invalid('the draft body is empty');
    }

    const decision = this.confirm(request, body);

    if (decision.declined) {
      return `STATUS=declined\nCHOICE=${decision.declined}\n`;
    }

    return this.publish(request, body, decision);
  }

  /**
   * @param {string[]} args - the raw arguments.
   * @returns {Promise<{file: string, title: string, confirmed: boolean, shipitConfirmed: boolean, labels: string[]}>}
   *   the validated request (labels deduped).
   * @throws {DispatchFailure} exit `2` on missing/unknown arguments, an
   *   unknown draft, an empty title, or a malformed label.
   */
  async parseArgs(args) {
    const [draft, title, ...rest] = args;

    if (!draft || title === undefined) {
      throw this.invalid(USAGE);
    }

    const flags = rest.filter((arg) => arg.startsWith('--'));
    const labels = rest.filter((arg) => !arg.startsWith('--'));
    const unknown = flags.find((flag) => flag !== CONFIRMED && flag !== SHIPIT_CONFIRMED);

    if (unknown) {
      throw this.invalid(`unknown option: ${unknown}`);
    }

    if (title.trim() === '') {
      throw this.invalid('the title is empty');
    }

    const malformed = labels.find((label) => !IssueLabels.isValid(label));

    if (malformed !== undefined) {
      throw this.invalid(`malformed label: ${JSON.stringify(malformed)}`);
    }

    const file = await this._draftStore.resolve(draft, this._repoContext.repoPath);

    if (!file) {
      throw this.invalid(`unknown draft: ${draft}`);
    }

    return {
      file,
      title: title.trim(),
      confirmed: flags.includes(CONFIRMED),
      shipitConfirmed: flags.includes(SHIPIT_CONFIRMED),
      labels: IssueLabels.dedupe(labels)
    };
  }

  /**
   * Run prompts 5 and 6 as needed, on `/dev/tty`.
   * @param {{title: string, confirmed: boolean, shipitConfirmed: boolean, labels: string[]}} request -
   *   the validated request.
   * @param {string} body - the issue body.
   * @returns {{declined: (string|undefined), labels: string[], shipitDropped: boolean}}
   *   the decision: `declined` is `'no'`/`'chat'` when prompt 5 was
   *   refused; otherwise the labels to apply.
   * @throws {DispatchFailure} exit `4` when a prompt is needed and the
   *   TTY is unavailable or reaches EOF.
   */
  confirm(request, body) {
    const needsShipit = IssueLabels.hasShipit(request.labels) && !request.shipitConfirmed;

    if (request.confirmed && !needsShipit) {
      return { declined: undefined, labels: request.labels, shipitDropped: false };
    }

    if (!this._tty.open()) {
      throw this.noTty();
    }

    try {
      return this.askPrompts(request, body, needsShipit);
    } finally {
      this._tty.close();
    }
  }

  /**
   * @param {{title: string, confirmed: boolean, labels: string[]}} request -
   *   the validated request.
   * @param {string} body - the issue body.
   * @param {boolean} needsShipit - whether prompt 6 must be asked.
   * @returns {{declined: (string|undefined), labels: string[], shipitDropped: boolean}}
   *   the decision.
   * @throws {DispatchFailure} exit `4` on TTY EOF.
   */
  askPrompts(request, body, needsShipit) {
    if (!request.confirmed) {
      const answer = this.askConfirmation(request, body);

      if (answer !== 'yes') {
        return { declined: answer, labels: [], shipitDropped: false };
      }
    }

    if (needsShipit && !this.askShipit()) {
      return { declined: undefined, labels: IssueLabels.withoutShipit(request.labels), shipitDropped: true };
    }

    return { declined: undefined, labels: request.labels, shipitDropped: false };
  }

  /**
   * Prompt 5: show the summary and ask `[Y]es / [N]o / [C]hat`.
   * @param {{title: string, labels: string[]}} request - the request.
   * @param {string} body - the issue body.
   * @returns {'yes'|'no'|'chat'} the answer.
   * @throws {DispatchFailure} exit `4` on TTY EOF.
   */
  askConfirmation(request, body) {
    this._tty.write(
      `Title:  ${request.title}\n` +
      `Labels: ${request.labels.length > 0 ? request.labels.join(', ') : 'none'}\n` +
      `Epic:   ${IssueLabels.hasEpic(request.labels) ? 'yes' : 'no'}\n` +
      `Body:   ${body.split('\n').length} lines\n`
    );

    const answer = this._tty.ask('Create this issue on GitHub? [Y]es / [N]o / [C]hat: ', (reply) => {
      const choices = { y: 'yes', yes: 'yes', n: 'no', no: 'no', c: 'chat', chat: 'chat' };

      return choices[reply.toLowerCase()];
    });

    return this.answered(answer);
  }

  /**
   * Prompt 6: the `shipit` warning, defaulting to No.
   * @returns {boolean} whether `shipit` is confirmed.
   * @throws {DispatchFailure} exit `4` on TTY EOF.
   */
  askShipit() {
    this._tty.write(
      'shipit pre-approves the whole PR lifecycle for this issue: auto-fix-all will merge the PR ' +
      'as soon as CI passes, with no review.\n'
    );

    const answer = this._tty.ask('Apply shipit? [y/N]: ', (reply) => {
      if (/^(y|yes)$/i.test(reply)) {
        return true;
      }

      return /^(n|no|)$/i.test(reply) ? false : undefined;
    });

    return this.answered(answer);
  }

  /**
   * @param {string|boolean|null} answer - a prompt's result.
   * @returns {string|boolean} the answer.
   * @throws {DispatchFailure} exit `4` when the TTY hit EOF (`null`).
   */
  answered(answer) {
    if (answer === null) {
      throw this.noTty();
    }

    return answer;
  }

  /**
   * Resolve labels, create the issue (once), delete the draft.
   * @param {{file: string, title: string}} request - the request.
   * @param {string} body - the issue body.
   * @param {{labels: string[], shipitDropped: boolean}} decision - the
   *   confirmed labels.
   * @returns {Promise<string>} the success output.
   * @throws {DispatchFailure} exit `1` on a GitHub failure.
   */
  async publish(request, body, decision) {
    const warnings = decision.shipitDropped ? ['shipit not confirmed; the issue was created without it'] : [];
    let labels;
    let issue;

    try {
      labels = await this._labels.resolve(decision.labels, warnings);
    } catch (error) {
      throw this.failed(error.message, warnings);
    }

    try {
      issue = await this._issueService.createWithLabels(this._repoContext.repoPath, {
        title: request.title,
        body,
        labels
      });
    } catch (error) {
      throw this.failed(`${error.message} (${CREATE_HINT})`, warnings);
    }

    try {
      await this._draftStore.delete(request.file);
    } catch {
      warnings.push(`draft not deleted: ${request.file}`);
    }

    return 'STATUS=ok\n' +
      `ID=${issue.number}\n` +
      `URL=${issue.html_url}\n` +
      `LABELS=${labels.join(',')}\n` +
      `EPIC=${IssueLabels.hasEpic(labels)}\n` +
      this.warningLines(warnings);
  }

  /**
   * @param {string} message - the validation error.
   * @returns {DispatchFailure} the exit-`2` failure.
   */
  invalid(message) {
    return new DispatchFailure(`ERROR=${message}\n`, EXIT_INVALID);
  }

  /**
   * @returns {DispatchFailure} the exit-`4` `FALLBACK=chat` failure.
   */
  noTty() {
    return new DispatchFailure('FALLBACK=chat\n', EXIT_NO_TTY);
  }

  /**
   * @param {string} message - the failure message.
   * @param {string[]} warnings - notes gathered so far.
   * @returns {DispatchFailure} the exit-`1` `STATUS=failed` failure.
   */
  failed(message, warnings) {
    const error = message.replace(/^Error: /, '');

    return new DispatchFailure(`STATUS=failed\nERROR=${error}\n${this.warningLines(warnings)}`, EXIT_FAILED);
  }

  /**
   * @param {string[]} warnings - the notes.
   * @returns {string} one `WARNING=` line per note.
   */
  warningLines(warnings) {
    return warnings.map((warning) => `WARNING=${warning}\n`).join('');
  }
}

export default ArcanumCreateIssuePublish;
