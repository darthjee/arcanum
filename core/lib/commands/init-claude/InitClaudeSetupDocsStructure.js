import { appendFile, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveInstallPath } from '../../utils/file/InstallRoot.js';

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
  '- **Responsible agents** — which specialist agent(s) each sub-issue is likely to fall to.',
  '- **Specs** — does any part of this work need a design agreed in `docs/agents/specs/` first (worth its own "write the spec" sub-issue), and do existing specs listed in `docs/agents/specs.md` constrain how the sub-issues are shaped?'
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

const SPECS_INDEX_PATH = 'docs/agents/specs.md';
const SPECS_DIR = 'docs/agents/specs';
const SPECS_GITKEEP_PATH = `${SPECS_DIR}/.gitkeep`;

const SPECS_INDEX_TEMPLATE = 'specs.md';
const DOCUMENTATION_SECTION_TEMPLATE = 'agents-documentation-section.md';

const SPECS_INDEX_NOTE =
  `Note: ${SPECS_INDEX_PATH} already exists and was left untouched; ` +
  'compare it with init-claude/templates/specs.md if it is outdated.\n';

const SPECS_DIR_WARNING =
  `Warning: ${SPECS_DIR} exists and is not a directory — skipping ${SPECS_GITKEEP_PATH}.\n`;

const MISSING_SPECS_LINK_WARNING =
  'Warning: AGENTS.md has a ## Documentation section with no link to docs/agents/specs.md — ' +
  'add the Specs row and the ### Specs subsection from ' +
  'init-claude/templates/agents-documentation-section.md.\n';

const MISSING_AGENTS_WARNING =
  'Warning: AGENTS.md not found — skipping Documentation section append.\n';

/**
 * Native implementation of the `init-claude-setup-docs-structure`
 * migrated entrypoint — byte-identical stdout/stderr/exit-code counterpart
 * to `init-claude/scripts/setup_docs_structure_shell.sh`. Creates the
 * standard `docs/agents/` structure in the target repo (never
 * overwriting an existing path): the placeholder docs, the specs index
 * copied from `init-claude/templates/specs.md`, and
 * `docs/agents/specs/.gitkeep` (only when `docs/agents/specs/` is missing
 * or empty). Appends a blank line plus
 * `init-claude/templates/agents-documentation-section.md` to the repo's
 * `AGENTS.md` when it has no `## Documentation` heading.
 *
 * Writes to stderr, in order: a note when the specs index already
 * exists, a warning when `docs/agents/specs` is not a directory, then
 * either the missing-`AGENTS.md` warning or a warning when an existing
 * Documentation section has no link to `docs/agents/specs.md`.
 */
class InitClaudeSetupDocsStructure {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath`.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {{write: function(string): boolean}} [deps.stderr] - the stream
   *   notes and warnings are written to (defaults to `process.stderr`).
   * @param {function(string): string} [deps.templatePath] - resolves a
   *   template name to its source path (defaults to the install's
   *   `init-claude/templates/<name>`).
   */
  constructor(repoContext, {
    stderr = process.stderr,
    templatePath = (name) => resolveInstallPath('init-claude', 'templates', name)
  } = {}) {
    this._repoContext = repoContext;
    this._stderr = stderr;
    this._templatePath = templatePath;
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
        await this._writeTextFile(target, entry.content);
        created.push(entry.path);
      }
    }

    await this._setupSpecsIndex(repoPath, created, skipped);
    await this._setupSpecsGitkeep(repoPath, created, skipped);

    const agentsStatus = await this._updateAgents(path.join(repoPath, AGENTS_FILE));

    return this._summary(created, skipped, agentsStatus);
  }

  /**
   * Write `content` plus a trailing newline to `target`, creating its
   * parent directories.
   * @param {string} target - absolute path to write.
   * @param {string} content - the file body, without its trailing newline.
   * @returns {Promise<void>}
   */
  async _writeTextFile(target, content) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${content}\n`);
  }

  /**
   * Copy the specs index template, or note that it was left untouched.
   * @param {string} repoPath - the target repo root.
   * @param {string[]} created - relative paths created (mutated).
   * @param {string[]} skipped - relative paths skipped (mutated).
   * @returns {Promise<void>}
   */
  async _setupSpecsIndex(repoPath, created, skipped) {
    const target = path.join(repoPath, SPECS_INDEX_PATH);

    if (await this._stat(target)) {
      skipped.push(SPECS_INDEX_PATH);
      this._stderr.write(SPECS_INDEX_NOTE);
      return;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(this._templatePath(SPECS_INDEX_TEMPLATE), target);
    created.push(SPECS_INDEX_PATH);
  }

  /**
   * Create `docs/agents/specs/.gitkeep` only when the specs directory is
   * missing or empty; warn when the path is not a directory.
   * @param {string} repoPath - the target repo root.
   * @param {string[]} created - relative paths created (mutated).
   * @param {string[]} skipped - relative paths skipped (mutated).
   * @returns {Promise<void>}
   */
  async _setupSpecsGitkeep(repoPath, created, skipped) {
    const gitkeep = path.join(repoPath, SPECS_GITKEEP_PATH);

    if (await this._stat(gitkeep)) {
      skipped.push(SPECS_GITKEEP_PATH);
      return;
    }

    const dirStat = await this._stat(path.join(repoPath, SPECS_DIR));

    if (dirStat && !dirStat.isDirectory()) {
      this._stderr.write(SPECS_DIR_WARNING);
      return;
    }

    if (dirStat && (await readdir(path.join(repoPath, SPECS_DIR))).length > 0) {
      return;
    }

    await this._writeTextFile(gitkeep, '');
    created.push(SPECS_GITKEEP_PATH);
  }

  /**
   * Append the documentation section to `AGENTS.md` when missing, or warn
   * when the existing section has no link to the specs index.
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
      if (!contents.includes(SPECS_INDEX_PATH)) {
        this._stderr.write(MISSING_SPECS_LINK_WARNING);
      }
      return 'present';
    }

    const section = await readFile(this._templatePath(DOCUMENTATION_SECTION_TEMPLATE));

    await appendFile(agentsPath, Buffer.concat([Buffer.from('\n'), section]));
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
