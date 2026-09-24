import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeSetupDocsStructure from '../../../../lib/commands/init-claude/InitClaudeSetupDocsStructure.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PATHS = [
  'docs/agents/issues/.gitkeep',
  'docs/agents/plans/.gitkeep',
  'docs/agents/architecture.md',
  'docs/agents/flow.md',
  'docs/agents/issue-enhancement.md',
  'docs/agents/arcanum-split-issue.md'
];

const WARNING = 'Warning: AGENTS.md not found — skipping Documentation section append.\n';

describe('InitClaudeSetupDocsStructure', () => {
  let dir;
  let stderr;
  let command;

  beforeEach(async () => {
    dir = await createTempDir();
    stderr = { write: jasmine.createSpy('write') };
    command = new InitClaudeSetupDocsStructure(new RepoContext({ repoPath: dir }), { stderr });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @param {string} relative - a path relative to the temp repo.
   * @returns {string} its absolute path.
   */
  function repo(relative) {
    return path.join(dir, relative);
  }

  /**
   * @param {string} relative - a path relative to the temp repo.
   * @returns {Promise<string>} its contents.
   */
  function read(relative) {
    return readFile(repo(relative), 'utf8');
  }

  /**
   * @param {string[]} paths - relative paths.
   * @returns {string} the indented listing lines.
   */
  function listing(paths) {
    return paths.map((file) => `  ${file}\n`).join('');
  }

  describe('on a fresh repo with AGENTS.md', () => {
    beforeEach(async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
    });

    it('creates every file and appends the section, reporting both', async () => {
      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS)}AGENTS.md: appended Documentation section\n`
      );
      expect(stderr.write).not.toHaveBeenCalled();
    });

    it('writes .gitkeep files as a single newline', async () => {
      await command.run();

      expect(await read('docs/agents/issues/.gitkeep')).toEqual('\n');
      expect(await read('docs/agents/plans/.gitkeep')).toEqual('\n');
    });

    it('writes the placeholder contents followed by a newline', async () => {
      await command.run();

      expect(await read('docs/agents/flow.md')).toEqual(
        '# Flow\n\n## Overview\n\n_Describe the main runtime flow of the application here._\n'
      );
      expect(await read('docs/agents/architecture.md')).toMatch(/^# Architecture\n\n## Overview\n/);
      expect(await read('docs/agents/architecture.md'))
        .toMatch(/_Describe the directory structure and the role of each module\._\n$/);
      expect(await read('docs/agents/issue-enhancement.md'))
        .toMatch(/^# Issue Enhancement\n\nA checklist .*\(tagged `Idea`\/`Writting`\).* — adjust/);
      expect(await read('docs/agents/issue-enhancement.md'))
        .toMatch(/anything relevant to load, latency, or attack surface\.\n$/);
      expect(await read('docs/agents/arcanum-split-issue.md'))
        .toMatch(/^# Arcanum Split Issue\n\nA checklist .*via `\/arcanum-split-issue`\./);
      expect(await read('docs/agents/arcanum-split-issue.md'))
        .toMatch(/each sub-issue is likely to fall to\.\n$/);
    });

    it('appends the section starting with a blank line', async () => {
      await command.run();

      const contents = await read('AGENTS.md');

      expect(contents.startsWith('# Agents\n\n## Documentation\n\nAll project documentation lives under'))
        .toBeTrue();
      expect(contents).toContain('| [Folder Structure](docs/agents/folder-structure.md) |');
      expect(contents).toContain('```\ndocs/agents/issues/<issue_id>_<issue_name>.md\n```\n');
      expect(contents.endsWith('Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.\n'))
        .toBeTrue();
    });
  });

  describe('on a re-run', () => {
    it('skips everything and leaves AGENTS.md unchanged', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await command.run();
      const agents = await read('AGENTS.md');

      await expectAsync(command.run()).toBeResolvedTo(
        `Already existed (skipped):\n${listing(PATHS)}` +
        'AGENTS.md: Documentation section already present (skipped)\n'
      );
      expect(await read('AGENTS.md')).toEqual(agents);
    });
  });

  describe('on a partial setup', () => {
    it('creates the missing paths and skips the present ones, in the fixed order', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents/plans'), { recursive: true });
      await writeFile(repo('docs/agents/plans/.gitkeep'), '');
      await writeFile(repo('docs/agents/flow.md'), 'custom');

      await expectAsync(command.run()).toBeResolvedTo(
        'Created:\n' +
        listing([PATHS[0], PATHS[2], PATHS[4], PATHS[5]]) +
        'Already existed (skipped):\n' +
        listing([PATHS[1], PATHS[3]]) +
        'AGENTS.md: appended Documentation section\n'
      );
      expect(await read('docs/agents/flow.md')).toEqual('custom');
      expect(await read('docs/agents/plans/.gitkeep')).toEqual('');
    });
  });

  describe('when a directory exists at a file path', () => {
    it('skips that path', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents/architecture.md'), { recursive: true });

      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS.filter((file) => file !== PATHS[2]))}` +
        `Already existed (skipped):\n${listing([PATHS[2]])}` +
        'AGENTS.md: appended Documentation section\n'
      );
      expect((await stat(repo('docs/agents/architecture.md'))).isDirectory()).toBeTrue();
    });
  });

  describe('when AGENTS.md is missing', () => {
    it('warns on stderr, prints no AGENTS.md line and does not create it', async () => {
      await expectAsync(command.run()).toBeResolvedTo(`Created:\n${listing(PATHS)}`);

      expect(stderr.write).toHaveBeenCalledOnceWith(WARNING);
      await expectAsync(stat(repo('AGENTS.md'))).toBeRejected();
    });

    it('treats a directory named AGENTS.md as missing', async () => {
      await mkdir(repo('AGENTS.md'));

      const output = await command.run();

      expect(output).not.toContain('AGENTS.md:');
      expect(stderr.write).toHaveBeenCalledOnceWith(WARNING);
    });
  });

  describe('when AGENTS.md has a heading starting with ## Documentation', () => {
    it('treats the section as present', async () => {
      const agents = '# Agents\n\n## Documentation Guide\n\nStuff\n';

      await writeFile(repo('AGENTS.md'), agents);

      const output = await command.run();

      expect(output.endsWith('AGENTS.md: Documentation section already present (skipped)\n')).toBeTrue();
      expect(await read('AGENTS.md')).toEqual(agents);
    });
  });

  it('defaults to writing the warning to process.stderr', async () => {
    spyOn(process.stderr, 'write');
    command = new InitClaudeSetupDocsStructure(new RepoContext({ repoPath: dir }));

    await command.run();

    expect(process.stderr.write).toHaveBeenCalledWith(WARNING);
  });
});
