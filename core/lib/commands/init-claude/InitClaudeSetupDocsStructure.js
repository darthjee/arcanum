import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ARCHITECTURE_CONTENT = [
  '# Architecture',
  '',
  '## Overview',
  '',
  '_Describe the high-level architecture of the project here._',
  '',
  '## Source Code Layout',
  '',
  '_Describe the directory structure and the role of each module._'
].join('\n');

const FLOW_CONTENT = [
  '# Flow',
  '',
  '## Overview',
  '',
  '_Describe the main runtime flow of the application here._'
].join('\n');

const ISSUE_ENHANCEMENT_CONTENT = [
  '# Issue Enhancement',
  '',
  'A checklist of concerns to consider when fleshing out a vague issue idea (tagged `Idea`/`Writting`) before it reaches the `Created` stage. Not exhaustive — adjust or extend the list for this project\'s needs.',
  '',
  '- **Scope boundaries** — what\'s explicitly in scope and what\'s explicitly out.',
  '- **Alternative solutions** — other ways to solve the same problem, and why this one was chosen.',
  '- **Edge cases** — inputs, states, or timing the happy path doesn\'t cover.',
  '- **Backward compatibility** — whether this breaks existing behavior, data, or integrations.',
  '- **Testing strategy** — how the change will be verified.',
  '- **Performance & security considerations** — anything relevant to load, latency, or attack surface.'
].join('\n');

const SPLIT_ISSUE_CONTENT = [
  '# Arcanum Split Issue',
  '',
  'A checklist of concerns to consider when splitting a broad issue into sub-issues via `/arcanum-split-issue`. Not exhaustive — adjust or extend the list for this project\'s needs.',
  '',
  '- **Sub-issue granularity** — is each sub-issue independently workable, or does it still depend on another sub-issue landing first?',
  '- **Standalone clarity** — does each sub-issue stand on its own, without requiring the reader to have the parent issue open to understand it?',
  '- **Shared contracts** — interfaces, schemas, or config keys touched by more than one sub-issue, and who owns getting them right first.',
  '- **Sequencing** — is there a natural order sub-issues should be implemented/merged in, or can they proceed in parallel?',
  '- **Responsible agents** — which specialist agent(s) each sub-issue is likely to fall to.'
].join('\n');

const FILES = Object.freeze([
  Object.freeze({ path: 'docs/agents/issues/.gitkeep', content: '' }),
  Object.freeze({ path: 'docs/agents/plans/.gitkeep', content: '' }),
  Object.freeze({ path: 'docs/agents/architecture.md', content: ARCHITECTURE_CONTENT }),
  Object.freeze({ path: 'docs/agents/flow.md', content: FLOW_CONTENT }),
  Object.freeze({ path: 'docs/agents/issue-enhancement.md', content: ISSUE_ENHANCEMENT_CONTENT }),
  Object.freeze({ path: 'docs/agents/arcanum-split-issue.md', content: SPLIT_ISSUE_CONTENT })
]);

const AGENTS_FILE = 'AGENTS.md';
const DOCUMENTATION_HEADING = /^## Documentation/m;

const DOCUMENTATION_SECTION = [
  '',
  '## Documentation',
  '',
  'All project documentation lives under [`docs/agents/`](docs/agents/):',
  '',
  '| File | Contents |',
  '|------|----------|',
  '| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |',
  '| [Architecture](docs/agents/architecture.md) | Source layout, modules, code style, and implementation guidelines. |',
  '| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |',
  '| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |',
  '| [Issues](docs/agents/issues/) | Detailed specs for open issues. |',
  '',
  '### Issues (`docs/agents/issues/`)',
  '',
  'Each file documents an issue in detail. Naming convention:',
  '',
  '```',
  'docs/agents/issues/<issue_id>_<issue_name>.md',
  '```',
  '',
  'Example: `docs/agents/issues/5_release_docker_image.md` for issue #5.',
  '',
  '### Plans (`docs/agents/plans/`)',
  '',
  'Each plan is a directory named after the issue ID and topic, containing one or more related files:',
  '',
  '```',
  'docs/agents/plans/<issue_id>_<topic>/<related_files>.md',
  '```',
  '',
  'Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.',
  ''
].join('\n');

const MISSING_AGENTS_WARNING =
  'Warning: AGENTS.md not found — skipping Documentation section append.\n';

/**
 * Native implementation of the `init-claude-setup-docs-structure`
 * migrated entrypoint — byte-identical stdout/exit-code counterpart to
 * `init-claude/scripts/setup_docs_structure_shell.sh`. Creates the
 * standard `docs/agents/` structure in the target repo (never
 * overwriting an existing path) and appends the standard
 * `## Documentation` section to its `AGENTS.md` when not already present.
 */
class InitClaudeSetupDocsStructure {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {{write: function(string): *}} [deps.stderr] - the stream the
   *   missing-`AGENTS.md` warning is written to (defaults to
   *   `process.stderr`).
   */
  constructor(repoContext, { stderr = process.stderr } = {}) {
    this._repoContext = repoContext;
    this._stderr = stderr;
  }

  /**
   * Create each missing docs file, then register the docs section in
   * `AGENTS.md`.
   * @returns {Promise<string>} a `Created:` block (if any), an
   *   `Already existed (skipped):` block (if any), then an `AGENTS.md:`
   *   status line (only when `AGENTS.md` is a regular file).
   */
  async run() {
    const { repoPath } = this._repoContext;
    const created = [];
    const skipped = [];

    for (const entry of FILES) {
      const target = path.join(repoPath, entry.path);

      if (await this._stat(target)) {
        skipped.push(entry.path);
      } else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, `${entry.content}\n`);
        created.push(entry.path);
      }
    }

    const agentsStatus = await this._updateAgents(path.join(repoPath, AGENTS_FILE));

    return this._summary(created, skipped, agentsStatus);
  }

  /**
   * Append the documentation section to `AGENTS.md` when missing.
   * @param {string} agentsPath - absolute path to the repo's `AGENTS.md`.
   * @returns {Promise<string|null>} `'appended'`, `'present'`, or null
   *   when `AGENTS.md` is not a regular file.
   */
  async _updateAgents(agentsPath) {
    const agentsStat = await this._stat(agentsPath);

    if (!agentsStat || !agentsStat.isFile()) {
      this._stderr.write(MISSING_AGENTS_WARNING);
      return null;
    }

    const contents = await readFile(agentsPath, 'utf8');

    if (DOCUMENTATION_HEADING.test(contents)) {
      return 'present';
    }

    await appendFile(agentsPath, DOCUMENTATION_SECTION);
    return 'appended';
  }

  /**
   * @param {string[]} created - relative paths created.
   * @param {string[]} skipped - relative paths that already existed.
   * @param {string|null} agentsStatus - the `AGENTS.md` outcome.
   * @returns {string} the stdout summary.
   */
  _summary(created, skipped, agentsStatus) {
    let output = '';

    if (created.length > 0) {
      output += 'Created:\n';
      output += created.map((file) => `  ${file}\n`).join('');
    }

    if (skipped.length > 0) {
      output += 'Already existed (skipped):\n';
      output += skipped.map((file) => `  ${file}\n`).join('');
    }

    if (agentsStatus === 'appended') {
      output += 'AGENTS.md: appended Documentation section\n';
    } else if (agentsStatus === 'present') {
      output += 'AGENTS.md: Documentation section already present (skipped)\n';
    }

    return output;
  }

  /**
   * @param {string} file - the path to stat (following symlinks, like
   *   `[[ -e ]]` / `[[ -f ]]`).
   * @returns {Promise<import('node:fs').Stats|null>} its stats, or null
   *   when it doesn't exist.
   */
  async _stat(file) {
    try {
      return await stat(file);
    } catch {
      return null;
    }
  }
}

export default InitClaudeSetupDocsStructure;
