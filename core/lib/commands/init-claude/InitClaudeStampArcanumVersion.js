import path from 'node:path';
import RepoConfigWriter from '../../utils/config/RepoConfigWriter.js';
import { INSTALL_ROOT } from '../../utils/file/InstallRoot.js';
import InstallVersion from '../../utils/file/InstallVersion.js';

const CONFIG_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');
const LOCAL_CONFIG_FILE = path.join('.claude', 'state', 'arcanum-config.json');
const LOCAL_NAMESPACE = 'migrations';
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * Native implementation of the `init-claude-stamp-arcanum-version`
 * migrated entrypoint — byte-identical stdout/exit-code counterpart to
 * `init-claude/scripts/stamp_arcanum_version_shell.sh`. Stamps this
 * arcanum install's version into the target repo's committed
 * `.claude/configuration/arcanum-repo-config.json` (`.version`) and
 * local `.claude/state/arcanum-config.json` (`.migrations.version`).
 * A version that can't be resolved as semver is a silent no-op.
 */
class InitClaudeStampArcanumVersion {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {InstallVersion} [deps.installVersion] - the install-version
   *   resolver.
   * @param {RepoConfigWriter} [deps.writer] - the repo-config writer.
   * @param {string} [deps.installRoot] - the arcanum install's root.
   */
  constructor(repoContext, {
    installVersion = new InstallVersion(),
    writer = new RepoConfigWriter(),
    installRoot = INSTALL_ROOT
  } = {}) {
    this._repoContext = repoContext;
    this._installVersion = installVersion;
    this._writer = writer;
    this._installRoot = installRoot;
  }

  /**
   * Resolve and stamp the install's version.
   * @returns {Promise<string>} always `''` (no stdout).
   */
  async run() {
    const version = await this._resolveVersion();

    if (!SEMVER.test(version)) {
      return '';
    }

    const { repoPath } = this._repoContext;

    await this._writer.setVersion({ file: path.join(repoPath, CONFIG_FILE), version });
    await this._writer.setVersion({
      file: path.join(repoPath, LOCAL_CONFIG_FILE),
      version,
      namespace: LOCAL_NAMESPACE
    });

    return '';
  }

  /**
   * @returns {Promise<string>} the resolved version, or `''` on any
   *   resolution error.
   */
  async _resolveVersion() {
    try {
      return await this._installVersion.resolve(this._installRoot);
    } catch {
      return '';
    }
  }
}

export default InitClaudeStampArcanumVersion;
