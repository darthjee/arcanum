import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import RepoContext from '../context/RepoContext.js';
import IssueStateService from '../services/IssueStateService.js';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import IssueStatePaths from '../utils/file/IssueStatePaths.js';
import Lock from '../utils/file/Lock.js';
import RepoPath from '../utils/file/RepoPath.js';
import JsonParser from '../utils/json/JsonParser.js';
import JsonReader from '../utils/json/JsonReader.js';
import JsonValueFormatter from '../utils/json/JsonValueFormatter.js';
import SpawnIssue from './SpawnIssue.js';

const USAGE = 'Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>';
const AS_SUBISSUE_FLAG = '--as-subissue';
const SUB_ISSUES_FIELD = 'sub-issues';

/**
 * Native equivalent of `arcanum-split-issue/scripts/create_sub_issue.sh`:
 * creates ONE sub-issue on GitHub from a local sub-issue draft file, links
 * it to the parent as a native GitHub sub-issue (delegated to
 * `SpawnIssue#run`), and tracks the new id in
 * `.claude/state/issue-<issue_id>.json`. See
 * docs/agents/plans/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js/node.md's
 * "Shared contracts".
 */
class ArcanumSplitIssueCreateSubIssue {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   * @param {SpawnIssue} [deps.spawnIssue] - issue-creation/linking helper.
   * @param {Function} [deps.readFile] - `node:fs/promises`'s `readFile`.
   * @param {Function} [deps.writeFile] - `node:fs/promises`'s `writeFile`.
   * @param {Function} [deps.mkdtemp] - `node:fs/promises`'s `mkdtemp`.
   * @param {Function} [deps.rm] - `node:fs/promises`'s `rm`.
   * @param {Lock} [deps.lock] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {JsonParser} [deps.jsonParser] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {JsonValueFormatter} [deps.jsonValueFormatter] - forwarded
   *   to each per-call `IssueStateService`.
   * @param {JsonReader} [deps.jsonReader] - forwarded to each per-call
   *   `IssueStateService`.
   * @param {IssueStatePaths} [deps.issueStatePaths] - forwarded to each
   *   per-call `IssueStateService`.
   */
  constructor({
    repoPath = new RepoPath(),
    spawnIssue = new SpawnIssue(),
    readFile: readFileFn = readFile,
    writeFile: writeFileFn = writeFile,
    mkdtemp: mkdtempFn = mkdtemp,
    rm: rmFn = rm,
    lock = new Lock(),
    jsonParser = new JsonParser(),
    jsonValueFormatter = new JsonValueFormatter(),
    jsonReader = new JsonReader(),
    issueStatePaths = new IssueStatePaths()
  } = {}) {
    this._repoPath = repoPath;
    this._spawnIssue = spawnIssue;
    this._readFile = readFileFn;
    this._writeFile = writeFileFn;
    this._mkdtemp = mkdtempFn;
    this._rm = rmFn;
    this._lock = lock;
    this._jsonParser = jsonParser;
    this._jsonValueFormatter = jsonValueFormatter;
    this._jsonReader = jsonReader;
    this._issueStatePaths = issueStatePaths;
  }

  /**
   * Native implementation of the `arcanum-split-issue-create-sub-issue`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `create_sub_issue.sh`. Validates all 3 arguments are present (usage
   * message otherwise, propagated uncaught so the caller exits 1),
   * validates `repoPath` (`RepoPath#validate`), reads and parses
   * `subIssueFile` (title/body), writes the progress line, delegates the
   * actual create/label/link work to `SpawnIssue#run` with
   * `--as-subissue`, tracks the new id in per-issue state, and returns
   * `STATUS=ok\nID=<new_id>\n` (prefixed with the progress line). On
   * `SpawnIssue#run`'s `DispatchFailure`, re-throws it as this module's
   * own `DispatchFailure`, prefixed with the same progress line.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @param {string} subIssueFile - path (absolute, or relative to
   *   `repoPath`) to the sub-issue draft file.
   * @returns {Promise<string>} the progress line followed by
   *   `STATUS=ok\nID=<new_id>\n`.
   * @throws {DispatchFailure} when `SpawnIssue#run`'s retry budget is
   *   exhausted — carries the progress line, `SpawnIssue#run`'s own
   *   `STATUS=failed\n`, and this module's own additional
   *   `STATUS=failed\n` on top (mirroring `create_sub_issue.sh`'s
   *   `echo "$SPAWN_OUTPUT"; echo "STATUS=failed"` — `STATUS=failed`
   *   legitimately appears twice).
   */
  async run(repoPath, issueId, subIssueFile) {
    if (!repoPath || !issueId || !subIssueFile) {
      throw new Error(USAGE);
    }

    await this._repoPath.validate(repoPath);

    const resolvedFile = path.resolve(repoPath, subIssueFile);
    let content;

    try {
      content = await this._readFile(resolvedFile, 'utf8');
    } catch {
      throw new Error(`Error: file not found: ${subIssueFile}`);
    }

    const { title, body } = this._parse(content);
    const countLabel = this._countLabel(subIssueFile, issueId);
    const progressLine = `Creating sub-issue ${countLabel} for issue #${issueId}: ${title}\n`;

    const tmpDir = await this._mkdtemp(path.join(os.tmpdir(), 'arcanum-sub-issue-'));
    const tmpBodyFile = path.join(tmpDir, 'body');

    try {
      await this._writeFile(tmpBodyFile, `${body}\n`);

      const spawnOutput = await this._spawn(repoPath, issueId, title, tmpBodyFile, progressLine);
      const newId = this._extractField(spawnOutput, 'ID');

      await this._issueStateService(repoPath).appendJson(issueId, SUB_ISSUES_FIELD, JSON.stringify(newId));

      return `${progressLine}STATUS=ok\nID=${newId}\n`;
    } finally {
      await this._rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Calls `SpawnIssue#run`, re-throwing any `DispatchFailure` as this
   * module's own instance so the failure surfaces with this script's
   * own progress line already printed — mirroring the shell script's
   * `echo "$SPAWN_OUTPUT"; echo "STATUS=failed"; exit 1` failure path
   * exactly: `SPAWN_OUTPUT` (here, `SpawnIssue#run`'s own
   * `STATUS=failed\n` stdout) is echoed verbatim, and THEN this
   * script's own additional `STATUS=failed` line is appended on top —
   * i.e. `STATUS=failed` legitimately appears twice in the resulting
   * stdout, not once (verified against the real shell script's output).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} issueId - the parent issue's numeric id.
   * @param {string} title - the sub-issue's title.
   * @param {string} bodyFile - the scratch file holding the parsed body.
   * @param {string} progressLine - the already-emitted progress line.
   * @returns {Promise<string>} `SpawnIssue#run`'s `STATUS=ok\nID=...\nURL=...\n`
   *   output.
   * @throws {DispatchFailure} re-thrown with `progressLine` prefixed and
   *   `SpawnIssue#run`'s own `STATUS=failed\n` stdout followed by this
   *   module's own extra `STATUS=failed\n` line.
   */
  async _spawn(repoPath, issueId, title, bodyFile, progressLine) {
    try {
      return await this._spawnIssue.run(repoPath, issueId, title, bodyFile, AS_SUBISSUE_FLAG);
    } catch (error) {
      if (error instanceof DispatchFailure) {
        throw new DispatchFailure(`${progressLine}${error.stdout}STATUS=failed\n`, error.exitCode);
      }

      throw error;
    }
  }

  /**
   * Parses `content` the same way the shell script's `sed`/`awk` do:
   * title = first line with a leading `# ` stripped (if present); body =
   * everything after the first blank line (mirroring `awk 'NR==1{next}
   * !found && /^$/{found=1; next} found{print}'`, itself captured via
   * `$(...)` command substitution, which strips all trailing newlines —
   * i.e. any trailing blank lines in the body are dropped).
   * @param {string} content - the raw sub-issue draft file contents.
   * @returns {{title: string, body: string}} the parsed title and body.
   */
  _parse(content) {
    const withoutTrailingNewline = content.endsWith('\n') ? content.slice(0, -1) : content;
    const lines = withoutTrailingNewline.split('\n');
    const titleLine = lines[0] ?? '';
    const title = titleLine.startsWith('# ') ? titleLine.slice(2) : titleLine;

    let found = false;
    const bodyLines = [];

    for (let i = 1; i < lines.length; i += 1) {
      if (!found) {
        if (lines[i] === '') {
          found = true;
        }

        continue;
      }

      bodyLines.push(lines[i]);
    }

    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === '') {
      bodyLines.pop();
    }

    return { title, body: bodyLines.join('\n') };
  }

  /**
   * Best-effort count segment for the progress line only, mirroring the
   * shell script's `basename` + prefix-strip + `%%_*` derivation:
   * `basename(subIssueFile)`, strip the `<issueId>_` prefix (if
   * present), take everything before the next `_`, falling back to `?`
   * when what remains isn't purely numeric.
   * @param {string} subIssueFile - the sub-issue draft file's path.
   * @param {string} issueId - the parent issue's numeric id.
   * @returns {string} the zero-padded count segment, or `?`.
   */
  _countLabel(subIssueFile, issueId) {
    const base = path.basename(subIssueFile);
    const prefix = `${issueId}_`;
    const rest = base.startsWith(prefix) ? base.slice(prefix.length) : base;
    const underscoreIndex = rest.indexOf('_');
    let countSegment = underscoreIndex === -1 ? rest : rest.slice(0, underscoreIndex);

    if (!/^[0-9]+$/.test(countSegment)) {
      countSegment = '';
    }

    return countSegment || '?';
  }

  /**
   * Build a per-call `IssueStateService`, wrapping `repoPath` into a
   * fresh `RepoContext` — mirroring `IssueState.js`'s
   * `_issueStateService(repoPath)` helper.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueStateService} the per-call `IssueStateService`.
   */
  _issueStateService(repoPath) {
    const context = new RepoContext({ repoPath });

    return new IssueStateService({
      context,
      lock: this._lock,
      jsonParser: this._jsonParser,
      jsonValueFormatter: this._jsonValueFormatter,
      jsonReader: this._jsonReader,
      issueStatePaths: this._issueStatePaths
    });
  }

  /**
   * Extract a `KEY=value` field's value from a multi-line `key=value`
   * output string, mirroring `grep '^KEY=' <<< "$output" | head -1 |
   * cut -d= -f2-`.
   * @param {string} output - the multi-line `KEY=value` output.
   * @param {string} key - the field name to extract.
   * @returns {string} the field's value, or an empty string when absent.
   */
  _extractField(output, key) {
    const prefix = `${key}=`;
    const line = output.split('\n').find((candidate) => candidate.startsWith(prefix));

    return line ? line.slice(prefix.length) : '';
  }
}

export default ArcanumSplitIssueCreateSubIssue;
