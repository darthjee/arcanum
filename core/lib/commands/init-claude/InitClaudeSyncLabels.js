import path from 'node:path';
import LabelConfig, { DEFAULT_LABEL_CONFIG_PATH } from '../../services/LabelConfig.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import GitHubClient from '../../utils/github/GitHubClient.js';
import LineReader from '../../utils/io/LineReader.js';

const PROMPT = 'Sync these labels to GitHub? [y/n]: ';
const EDGE_BLANKS = /^[ \t]+|[ \t]+$/g;

/**
 * Native implementation of the `init-claude-sync-labels` migrated
 * entrypoint — byte-identical stdout/exit-code counterpart to
 * `init-claude/scripts/sync_labels_shell.sh`. Prints the configured
 * label/color table, asks for confirmation on stdin, then creates or
 * updates each label on GitHub. The repo is resolved lazily, only after
 * a "yes" (the registry entry sets `validateRepoPath: false`), so a
 * non-git `repoPath` still prints the table and prompt first.
 */
class InitClaudeSyncLabels {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {LabelConfig} [deps.labelConfig] - the label-config service.
   * @param {LineReader} [deps.lineReader] - stdin line reader.
   * @param {{write: (text: string) => unknown}} [deps.stdout] - stdout
   *   writer.
   * @param {(context: object) => GitHubClient} [deps.githubClientFactory] - builds a
   *   `GitHubClient` from the context, called only after a "yes".
   */
  constructor(repoContext, {
    labelConfig = new LabelConfig(),
    lineReader = new LineReader(),
    stdout = process.stdout,
    githubClientFactory = (context) => new GitHubClient({ context })
  } = {}) {
    this._repoContext = repoContext;
    this._labelConfig = labelConfig;
    this._lineReader = lineReader;
    this._stdout = stdout;
    this._githubClientFactory = githubClientFactory;
  }

  /**
   * Print the table, confirm, then sync.
   * @param {string} [configPath] - the config file's path (defaults to
   *   `.claude/state/init-claude-config.json`, resolved against
   *   `repoPath`).
   * @returns {Promise<string>} `''` — all stdout is streamed.
   * @throws {DispatchFailure} exit 2 on an invalid config pair or EOF,
   *   `STATUS=discuss` / exit 1 on "no".
   */
  async run(configPath = DEFAULT_LABEL_CONFIG_PATH) {
    const resolved = path.resolve(this._repoContext.repoPath, configPath);

    await this._labelConfig.ensureDefaults(resolved);

    const pairs = await this._labelConfig.readPairs(resolved);

    this._validate(pairs);
    this._printTable(pairs);

    const confirmed = await this._confirm();

    if (!confirmed) {
      throw new DispatchFailure('STATUS=discuss\n', 1);
    }

    await this._sync(pairs);

    return '';
  }

  /**
   * Validate every configured pair, like the shell's
   * `label_config_validate_pair || usage`.
   * @param {Array<{name: string, color: string}>} pairs - the labels.
   * @returns {void}
   * @throws {DispatchFailure} exit 2 after the error and usage lines.
   * @private
   */
  _validate(pairs) {
    for (const { name, color } of pairs) {
      const error = this._labelConfig.validatePair(`${name}:${color}`);

      if (error !== null) {
        process.stderr.write(
          `${error}\n` +
          'Usage: sync_labels.sh <repo_path> [<config_path>]\n' +
          `  config_path defaults to ${DEFAULT_LABEL_CONFIG_PATH}\n`
        );
        throw new DispatchFailure('', 2);
      }
    }
  }

  /**
   * Stream the markdown label table to stdout.
   * @param {Array<{name: string, color: string}>} pairs - the labels.
   * @returns {void}
   * @private
   */
  _printTable(pairs) {
    const rows = pairs.map(({ name, color }) => `| ${name} | #${color} |\n`);

    this._stdout.write(`| Label | Color |\n| --- | --- |\n${rows.join('')}`);
  }

  /**
   * Prompt until a recognized answer, mirroring `read -r` + `tr` (trim
   * spaces/tabs, lowercase).
   * @returns {Promise<boolean>} `true` for y/yes, `false` for n/no.
   * @throws {DispatchFailure} exit 2 on EOF.
   * @private
   */
  async _confirm() {
    try {
      for (;;) {
        this._stdout.write(PROMPT);

        const line = await this._lineReader.readLine();

        if (line === null) {
          process.stderr.write('Error: no input available for confirmation prompt\n');
          throw new DispatchFailure('', 2);
        }

        const answer = line.replace(EDGE_BLANKS, '').toLowerCase();

        if (answer === 'y' || answer === 'yes') {
          return true;
        }

        if (answer === 'n' || answer === 'no') {
          return false;
        }
      }
    } finally {
      await this._lineReader.close();
    }
  }

  /**
   * Create or update each label on GitHub, streaming one line per label.
   * @param {Array<{name: string, color: string}>} pairs - the labels.
   * @returns {Promise<void>}
   * @private
   */
  async _sync(pairs) {
    const client = this._githubClientFactory(this._repoContext);
    const existing = await client.listLabelNames();

    this._stdout.write('STATUS=synced\n');

    for (const { name, color } of pairs) {
      const lowered = name.toLowerCase();
      const match = existing.find((existingName) => existingName.toLowerCase() === lowered);

      if (match === undefined) {
        await client.createLabel(name, color);
        this._stdout.write(`CREATED=${name}\n`);
      } else {
        await client.updateLabel(match, name, color);
        this._stdout.write(`UPDATED=${name}\n`);
      }
    }
  }
}

export default InitClaudeSyncLabels;
