import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);
const ADD_SUB_ISSUE_MUTATION =
  'mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}';

/**
 * Best-effort cross-linking of a freshly-spawned issue back to its
 * parent — extracted from `SpawnIssue`'s own `_linkBack`/`_linkSubIssue`/
 * `_nodeId` steps: comments on both issues, and — when requested —
 * additionally links them as a native GitHub sub-issue pair via the
 * `addSubIssue` GraphQL mutation. Never throws — every `gh` call here is
 * best-effort, warning to stderr on failure.
 */
class IssueLinker {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * Best-effort: comment on both the parent and the new issue,
   * cross-linking them, and — when `asSubissue` is set — additionally
   * link the new issue as a native GitHub sub-issue of the parent via
   * the `addSubIssue` GraphQL mutation. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} title - the new issue's title.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @param {boolean} asSubissue - whether to also link as a native
   *   GitHub sub-issue.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async link(parentId, newId, title, repoRef, asSubissue) {
    try {
      await this._execFileAsync('gh', [
        'issue', 'comment', String(parentId), '-R', repoRef, '--body', `Spawned issue #${newId}: ${title}`
      ]);
    } catch {
      process.stderr.write(`Warning: could not comment on parent issue #${parentId} on ${repoRef}\n`);
    }

    try {
      await this._execFileAsync('gh', [
        'issue', 'comment', String(newId), '-R', repoRef, '--body', `Spawned from #${parentId}`
      ]);
    } catch {
      process.stderr.write(`Warning: could not comment on issue #${newId} on ${repoRef}\n`);
    }

    if (!asSubissue) {
      return;
    }

    await this._linkSubIssue(parentId, newId, repoRef);
  }

  /**
   * Best-effort: resolve both issues' GraphQL node ids and run the
   * `addSubIssue` mutation, warning to stderr on any failure along the
   * way. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _linkSubIssue(parentId, newId, repoRef) {
    const parentNodeId = await this._nodeId(parentId, repoRef);
    const subNodeId = await this._nodeId(newId, repoRef);

    let linked = false;

    if (parentNodeId && subNodeId) {
      try {
        await this._execFileAsync('gh', [
          'api', 'graphql',
          '-f', `query=${ADD_SUB_ISSUE_MUTATION}`,
          '-F', `issueId=${parentNodeId}`,
          '-F', `subIssueId=${subNodeId}`
        ]);
        linked = true;
      } catch {
        linked = false;
      }
    }

    if (!linked) {
      process.stderr.write(
        `Warning: could not link issue #${newId} as a native sub-issue of #${parentId} — created but not linked; link it manually on GitHub\n`
      );
    }
  }

  /**
   * @param {string} id - the issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<string>} the issue's GraphQL node id, or an empty
   *   string on any lookup failure.
   */
  async _nodeId(id, repoRef) {
    try {
      const { stdout } = await this._execFileAsync('gh', [
        'issue', 'view', String(id), '-R', repoRef, '--json', 'id', '-q', '.id'
      ]);

      return stdout.trim();
    } catch {
      return '';
    }
  }
}

export default IssueLinker;
