import path from 'node:path';
import RepoConfigWriter from '../../utils/config/RepoConfigWriter.js';

const NEW_CONFIG_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');
const LEGACY_CONFIG_FILE = path.join('.claude', 'configuration', 'auto-fix-all.json');
const NAMESPACE = 'auto-fix-all';
const KEY = 'ignored_check_patterns';

/**
 * Native implementation of the `init-claude-set-ci-ignored-patterns`
 * migrated entrypoint — byte-identical stdout/exit-code counterpart to
 * `init-claude/scripts/set_ci_ignored_patterns_shell.sh`. Writes
 * `auto-fix-all.ignored_check_patterns` in the target repo's
 * `.claude/configuration/arcanum-repo-config.json` (seeding the
 * namespace from the legacy `.claude/configuration/auto-fix-all.json`
 * when absent, like `repo_config_write`).
 */
class InitClaudeSetCiIgnoredPatterns {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoConfigWriter} [deps.writer] - the repo-config writer.
   */
  constructor(repoContext, { writer = new RepoConfigWriter() } = {}) {
    this._repoContext = repoContext;
    this._writer = writer;
  }

  /**
   * Write the given patterns (or `[]` for a lone `--clear`). Mirrors
   * `printf '%s\n' "$@" | jq -R . | jq -s -c .`, which splits any
   * argument containing a newline into several elements.
   * @param {...string} args - the patterns, or the single `--clear` flag.
   * @returns {Promise<string>} `''` (no stdout).
   * @throws {Error} a usage error when no argument is given (the shim
   *   normally rejects this before dispatching).
   */
  async run(...args) {
    if (args.length === 0) {
      throw new Error('Usage: set_ci_ignored_patterns.sh <pattern-1> [<pattern-2> ...] | --clear');
    }

    const patterns = args.length === 1 && args[0] === '--clear'
      ? []
      : args.flatMap((arg) => arg.split('\n'));
    const { repoPath } = this._repoContext;

    await this._writer.write({
      newFile: path.join(repoPath, NEW_CONFIG_FILE),
      legacyFile: path.join(repoPath, LEGACY_CONFIG_FILE),
      namespace: NAMESPACE,
      key: KEY,
      value: patterns
    });

    return '';
  }
}

export default InitClaudeSetCiIgnoredPatterns;
