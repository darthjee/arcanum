import DispatchFailure from '../../utils/errors/DispatchFailure.js';

// Fixed affirmative word/phrase set — a literal match, not a glob (see
// discuss-issue/scripts/confirm_shell.sh's `case` statement). "looks
// good" is exactly that string, with a single interior space.
const AFFIRMATIVE = new Set(['yes', 'y', 'sim', 'correct', 'looks good', 'sure', 'ok', 'okay']);

/**
 * Native equivalent of `discuss-issue/scripts/confirm_shell.sh`:
 * deterministically resolves a free-form yes/no-ish reply to a boolean.
 * Does no I/O and needs no injectable collaborators — pure string
 * normalization on its one argument. See
 * docs/agents/plans/447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js/node.md.
 *
 * Note: `tr '[:upper:]' '[:lower:]'` is ASCII-only, while
 * `String.prototype.toLowerCase()` is Unicode-aware, and POSIX
 * `[[:space:]]` is a narrower class than JS `\s`. This is a latent
 * divergence risk, though none of the current affirmative/negative
 * words trigger it.
 */
class DiscussIssueConfirm {
  /**
   * Native implementation of the `discuss-issue-confirm` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `confirm_shell.sh`. Never writes to stdout/stderr in either
   * outcome: resolves (no output, exit code 0) when `reply` normalizes
   * to one of the fixed affirmative words/phrases, otherwise rejects
   * with a `DispatchFailure` (empty stdout, exit code 1) — including
   * for explicit negatives, unrecognized replies, and a missing/empty
   * argument.
   * @param {string} [reply] - the free-form reply to resolve.
   * @returns {Promise<void>} resolves when `reply` is affirmative.
   * @throws {DispatchFailure} with empty stdout and exit code 1
   *   otherwise.
   */
  async run(reply = '') {
    const normalized = reply
      .toLowerCase()
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .replace(/[.!?]+$/, '');

    if (!AFFIRMATIVE.has(normalized)) {
      throw new DispatchFailure('', 1);
    }
  }
}

export default DiscussIssueConfirm;
