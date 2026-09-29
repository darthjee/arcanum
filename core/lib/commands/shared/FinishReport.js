import { TAG_TO_LABEL } from '../../utils/issue/Tags.js';

const STATUSES = new Set(['success', 'declined', 'failed']);
const NUMERIC_ID_PATTERN = /^[0-9]+$/;
const VALUE_FLAGS = new Set([
  '--skill', '--status', '--summary', '--issue', '--pr', '--sub-issue', '--label-change', '--next', '--merge'
]);
// GitHub's ssh-over-443 host has no web UI of its own — its URLs live
// on `github.com`.
const WEB_DOMAIN_ALIASES = { 'ssh.github.com': 'github.com' };

/**
 * Native implementation of the `finish-report` migrated entrypoint —
 * byte-identical stdout/exit-code counterpart to
 * `arcanum/_lib/finish_report_shell.sh`. Renders the uniform
 * end-of-skill report (or, with `--nested`, the `FINISH_*` result-data
 * block) described in docs/agents/architecture/skill-finish.md. Pure
 * formatting plus local git-origin parsing: no network call and no
 * GitHub token. Any usage error throws a plain `Error`, which
 * `core/bin/arcanum` surfaces as a stderr message, empty stdout and
 * exit code 1.
 */
class FinishReport {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, used only to resolve `origin` when an
   *   issue or PR URL is needed.
   */
  constructor(repoContext) {
    this._repoContext = repoContext;
  }

  /**
   * Parse the flag list, apply any `--merge` blocks, and render either
   * the report or the `--nested` block.
   * @param {...string} args - the CLI flags following `<repo_path>`.
   * @returns {Promise<string>} the report or `FINISH_*` block, one
   *   `\n`-terminated line each.
   * @throws {Error} on any usage error.
   */
  async run(...args) {
    const repoPath = this._repoContext.repoPath ?? '';

    if (!repoPath || repoPath.startsWith('--')) {
      throw new Error('Error: <repo_path> is required as the first argument');
    }

    const options = this._parse(args);

    this._validate(options);
    options.merges.forEach((block) => this._merge(options, block));

    if (options.nested) {
      return this._renderNested(options);
    }

    return this._renderReport(options);
  }

  /**
   * @param {string[]} args - the raw CLI flags.
   * @returns {object} the parsed options.
   */
  _parse(args) {
    const options = {
      skill: '',
      status: '',
      summary: undefined,
      issue: '',
      pr: '',
      subIssues: [],
      labelChanges: [],
      nexts: [],
      merges: [],
      nested: false
    };

    for (let index = 0; index < args.length; index += 1) {
      const flag = args[index];

      if (flag === '--nested') {
        options.nested = true;
        continue;
      }

      if (!VALUE_FLAGS.has(flag)) {
        throw new Error(`Error: unknown argument: ${flag}`);
      }

      if (index + 1 >= args.length) {
        throw new Error(`Error: ${flag} requires a value`);
      }

      index += 1;
      this._assign(options, flag, args[index]);
    }

    return options;
  }

  /**
   * @param {object} options - the options being built.
   * @param {string} flag - the flag name.
   * @param {string} value - the flag's value.
   * @returns {void}
   */
  _assign(options, flag, value) {
    switch (flag) {
    case '--skill': options.skill = value; break;
    case '--status': options.status = value; break;
    case '--summary': options.summary = value; break;
    case '--issue': options.issue = value; break;
    case '--pr': options.pr = value; break;
    case '--sub-issue': options.subIssues.push(value); break;
    case '--label-change': options.labelChanges.push(value); break;
    case '--next': options.nexts.push(value); break;
    default: options.merges.push(value);
    }
  }

  /**
   * @param {object} options - the parsed options; `summary` is trimmed
   *   in place.
   * @returns {void}
   * @throws {Error} on any invalid value.
   */
  _validate(options) {
    if (!options.skill) {
      throw new Error('Error: --skill is required');
    }

    if (!STATUSES.has(options.status)) {
      throw new Error(`Error: --status must be one of success|declined|failed (got '${options.status}')`);
    }

    options.summary = (options.summary ?? '').trim();

    if (!options.summary) {
      throw new Error('Error: --summary is required');
    }

    if (options.summary.includes('\n')) {
      throw new Error('Error: --summary must be a single line');
    }

    if (options.issue) {
      this._assertId('--issue', options.issue);
    }

    if (options.pr) {
      this._assertId('--pr', options.pr);
    }

    options.subIssues.forEach((id) => this._assertId('--sub-issue', id));
    options.labelChanges.forEach((change) => this._assertLabelChange(change));
  }

  /**
   * @param {string} flag - the flag the id came from, for the message.
   * @param {string} id - the id to check.
   * @returns {void}
   * @throws {Error} when `id` is not numeric.
   */
  _assertId(flag, id) {
    if (!NUMERIC_ID_PATTERN.test(id)) {
      throw new Error(`Error: ${flag} must be numeric (got '${id}')`);
    }
  }

  /**
   * @param {string} change - a `<before_tag>:<after_tag>` pair.
   * @returns {void}
   * @throws {Error} when malformed, both sides are empty, or a tag is
   *   unknown.
   */
  _assertLabelChange(change) {
    if (!change.includes(':')) {
      throw new Error(`Error: --label-change must be <before_tag>:<after_tag> (got '${change}')`);
    }

    const [before, after] = this._splitLabelChange(change);

    if (!before && !after) {
      throw new Error('Error: --label-change needs at least one tag');
    }

    [before, after].filter(Boolean).forEach((tag) => {
      if (!Object.hasOwn(TAG_TO_LABEL, tag)) {
        throw new Error(`Error: unknown tag: ${tag}`);
      }
    });
  }

  /**
   * @param {string} change - a `<before_tag>:<after_tag>` pair.
   * @returns {string[]} `[before, after]`, split on the first `:`.
   */
  _splitLabelChange(change) {
    const colon = change.indexOf(':');

    return [change.slice(0, colon), change.slice(colon + 1)];
  }

  /**
   * Apply one nested `FINISH_*` block to the caller's options.
   * @param {object} options - the caller's validated options.
   * @param {string} block - a nested run's `--nested` stdout.
   * @returns {void}
   * @throws {Error} when the nested run failed but the caller reports
   *   success, or when the block carries an invalid id or tag.
   */
  _merge(options, block) {
    const nested = { issue: '', pr: '', subIssues: [], labelChanges: [] };

    block.split('\n').forEach((line) => this._readMergeLine(nested, line));

    if (nested.status === 'failed' && options.status === 'success') {
      throw new Error('Error: a nested run failed; the caller cannot report success');
    }

    options.issue ||= nested.issue;
    options.pr ||= nested.pr;
    nested.subIssues.forEach((id) => this._appendUnique(options.subIssues, id));
    nested.labelChanges.forEach((change) => this._appendUnique(options.labelChanges, change));
  }

  /**
   * @param {object} nested - the nested data being collected.
   * @param {string} line - one line of a merge block.
   * @returns {void}
   */
  _readMergeLine(nested, line) {
    const equals = line.indexOf('=');

    if (equals === -1) {
      return;
    }

    const key = line.slice(0, equals);
    const value = line.slice(equals + 1);

    switch (key) {
    case 'FINISH_STATUS':
      nested.status = value;
      break;
    case 'FINISH_ISSUE':
      this._assertId('FINISH_ISSUE', value);
      nested.issue ||= value;
      break;
    case 'FINISH_PR':
      this._assertId('FINISH_PR', value);
      nested.pr ||= value;
      break;
    case 'FINISH_SUB_ISSUE':
      this._assertId('FINISH_SUB_ISSUE', value);
      nested.subIssues.push(value);
      break;
    case 'FINISH_LABEL_CHANGE':
      this._assertLabelChange(value);
      nested.labelChanges.push(value);
      break;
    default:
      break;
    }
  }

  /**
   * @param {string[]} list - the list to append to.
   * @param {string} value - the value to append unless already present.
   * @returns {void}
   */
  _appendUnique(list, value) {
    if (!list.includes(value)) {
      list.push(value);
    }
  }

  /**
   * @param {object} options - the merged options.
   * @returns {string} the `FINISH_*` block.
   */
  _renderNested(options) {
    const lines = [
      `FINISH_SKILL=${options.skill}`,
      `FINISH_STATUS=${options.status}`,
      `FINISH_SUMMARY=${options.summary}`
    ];

    if (options.issue) {
      lines.push(`FINISH_ISSUE=${options.issue}`);
    }

    if (options.pr) {
      lines.push(`FINISH_PR=${options.pr}`);
    }

    options.subIssues.forEach((id) => lines.push(`FINISH_SUB_ISSUE=${id}`));
    options.labelChanges.forEach((change) => lines.push(`FINISH_LABEL_CHANGE=${change}`));

    return this._joinLines(lines);
  }

  /**
   * @param {object} options - the merged options.
   * @returns {Promise<string>} the human-readable report.
   */
  async _renderReport(options) {
    const lines = [`== ${options.skill}: ${options.status.toUpperCase()} ==`, options.summary];

    if (options.issue || options.pr) {
      const baseUrl = await this._baseUrl();

      if (options.issue) {
        lines.push(`Issue: #${options.issue} ${baseUrl}/issues/${options.issue}`);
      }

      if (options.pr) {
        lines.push(`PR: #${options.pr} ${baseUrl}/pull/${options.pr}`);
      }
    }

    if (options.subIssues.length > 0) {
      lines.push(`Sub-issues: ${options.subIssues.map((id) => `#${id}`).join(' ')}`);
    }

    options.labelChanges.forEach((change) => lines.push(`Labels: ${this._labelLine(change)}`));
    options.nexts.forEach((command) => lines.push(`Next: ${command}`));

    return this._joinLines(lines);
  }

  /**
   * @returns {Promise<string>} `https://<web-domain>/<owner>/<repo>`.
   */
  async _baseUrl() {
    const { domain, repo } = await this._repoContext.resolve();
    const webDomain = WEB_DOMAIN_ALIASES[domain] ?? domain;

    return `https://${webDomain}/${repo}`;
  }

  /**
   * @param {string} change - a validated `<before_tag>:<after_tag>` pair.
   * @returns {string} `<BeforeLabel> -> <AfterLabel>`, `(none)` for an
   *   empty side.
   */
  _labelLine(change) {
    const [before, after] = this._splitLabelChange(change).map((tag) => (tag ? TAG_TO_LABEL[tag] : '(none)'));

    return `${before} -> ${after}`;
  }

  /**
   * @param {string[]} lines - the output lines.
   * @returns {string} the lines, each `\n`-terminated.
   */
  _joinLines(lines) {
    return `${lines.join('\n')}\n`;
  }
}

export default FinishReport;
