import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Tags from './Tags.js';

const defaultExecFileAsync = promisify(execFile);
const SPAWNED_LABEL = 'Spawned';

/**
 * Best-effort GitHub label carryover for a freshly-spawned issue —
 * extracted from `SpawnIssue`'s own `_applyLabels` step: fetches the
 * parent issue's labels, strips any label that maps to a canonical
 * pipeline tag (`Tags.extractTags`), keeps everything else, and always
 * adds the permanent `Spawned` label on top. Never throws — every `gh`
 * call here is best-effort, warning to stderr on failure.
 */
class LabelApplicator {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * Best-effort: fetch `parentId`'s current labels, strip any label
   * that maps to a canonical pipeline tag, keep everything else, then
   * always add `Spawned` on top. Falls back to applying just `Spawned`
   * when the parent-labels lookup itself fails. Never throws.
   * @param {string} parentId - the parent issue's numeric id.
   * @param {string} newId - the newly-created issue's numeric id.
   * @param {string} repoRef - the `owner/repo` GitHub reference.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async apply(parentId, newId, repoRef) {
    let labelsToApply = [];

    try {
      const { stdout } = await this._execFileAsync('gh', [
        'issue', 'view', String(parentId), '-R', repoRef, '--json', 'labels', '-q', '.labels[].name'
      ]);

      labelsToApply = stdout
        .split('\n')
        .map((label) => label.trim())
        .filter((label) => label.length > 0)
        .filter((label) => Tags.extractTags([label]).length === 0);
    } catch (error) {
      process.stderr.write(
        `Warning: could not fetch labels from parent issue #${parentId} on ${repoRef}: ${error.message} — applying only 'Spawned'\n`
      );
    }

    labelsToApply.push(SPAWNED_LABEL);

    const labelArgs = labelsToApply.flatMap((label) => ['--add-label', label]);

    try {
      await this._execFileAsync('gh', ['issue', 'edit', String(newId), '-R', repoRef, ...labelArgs]);
    } catch {
      process.stderr.write(`Warning: could not apply labels to issue #${newId} on ${repoRef}\n`);
    }
  }
}

export default LabelApplicator;
