import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeSetupDocsStructure from '../../../../lib/commands/init-claude/InitClaudeSetupDocsStructure.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { resolveInstallPath } from '../../../../lib/utils/file/InstallRoot.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const PATHS = [
  'docs/agents/issues/.gitkeep',
  'docs/agents/plans/.gitkeep',
  'docs/agents/architecture.md',
  'docs/agents/flow.md',
  'docs/agents/issue-enhancement.md',
  'docs/agents/arcanum-split-issue.md',
  'docs/agents/specs.md',
  'docs/agents/specs/.gitkeep'
];

const SPECS_INDEX = 'docs/agents/specs.md';
const SPECS_GITKEEP = 'docs/agents/specs/.gitkeep';

const WARNING = 'Warning: AGENTS.md not found — skipping Documentation section append.\n';

const SPECS_INDEX_NOTE =
  'Note: docs/agents/specs.md already exists and was left untouched; ' +
  'compare it with init-claude/templates/specs.md if it is outdated.\n';

const SPECS_DIR_WARNING =
  'Warning: docs/agents/specs exists and is not a directory — skipping docs/agents/specs/.gitkeep.\n';

const MISSING_SPECS_LINK_WARNING =
  'Warning: AGENTS.md has a ## Documentation section with no link to docs/agents/specs.md — ' +
  'add the Specs row and the ### Specs subsection from ' +
  'init-claude/templates/agents-documentation-section.md.\n';

/**
 * @param {string} name - a template file name.
 * @returns {Promise<string>} the install template's contents.
 */
function template(name) {
  return readFile(resolveInstallPath('init-claude', 'templates', name), 'utf8');
}

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
      expect(await read(SPECS_GITKEEP)).toEqual('\n');
    });

    it('copies the specs index template byte-for-byte', async () => {
      await command.run();

      expect(await read(SPECS_INDEX)).toEqual(await template('specs.md'));
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
      expect(contents).toEqual(`# Agents\n\n${await template('agents-documentation-section.md')}`);
      expect(contents).toContain('| [Folder Structure](docs/agents/folder-structure.md) |');
      expect(contents).toContain('| [Specs](docs/agents/specs.md) |');
      expect(contents).toContain('### Specs (`docs/agents/specs/`)');
      expect(contents).toContain('```\ndocs/agents/issues/<issue_id>_<issue_name>.md\n```\n');
    });
  });

  describe('on a re-run', () => {
    it('skips everything and leaves AGENTS.md unchanged', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await command.run();
      const agents = await read('AGENTS.md');

      stderr.write.calls.reset();

      await expectAsync(command.run()).toBeResolvedTo(
        `Already existed (skipped):\n${listing(PATHS)}` +
        'AGENTS.md: Documentation section already present (skipped)\n'
      );
      expect(await read('AGENTS.md')).toEqual(agents);
      expect(stderr.write).toHaveBeenCalledOnceWith(SPECS_INDEX_NOTE);
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
        listing([PATHS[0], PATHS[2], PATHS[4], PATHS[5], PATHS[6], PATHS[7]]) +
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

  describe('when AGENTS.md has a Documentation section', () => {
    it('warns when it has no link to the specs index, leaving it unchanged', async () => {
      const agents = '# Agents\n\n## Documentation\n\n| [Issues](docs/agents/issues/) | x |\n';

      await writeFile(repo('AGENTS.md'), agents);

      const output = await command.run();

      expect(output.endsWith('AGENTS.md: Documentation section already present (skipped)\n')).toBeTrue();
      expect(await read('AGENTS.md')).toEqual(agents);
      expect(stderr.write).toHaveBeenCalledOnceWith(MISSING_SPECS_LINK_WARNING);
    });

    it('does not warn when it links the specs index', async () => {
      const agents = '# Agents\n\n## Documentation\n\n| [Specs](docs/agents/specs.md) | x |\n';

      await writeFile(repo('AGENTS.md'), agents);

      await command.run();

      expect(await read('AGENTS.md')).toEqual(agents);
      expect(stderr.write).not.toHaveBeenCalled();
    });

    it('writes the warning after the per-file messages', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n\n## Documentation\n');
      await mkdir(repo('docs/agents'), { recursive: true });
      await writeFile(repo(SPECS_INDEX), 'custom\n');
      await writeFile(repo('docs/agents/specs'), 'not a dir\n');

      await command.run();

      expect(stderr.write.calls.allArgs()).toEqual([
        [SPECS_INDEX_NOTE],
        [SPECS_DIR_WARNING],
        [MISSING_SPECS_LINK_WARNING]
      ]);
    });
  });

  describe('when the specs index already exists', () => {
    it('leaves it untouched, lists it as skipped and writes the note', async () => {
      const custom = '# Specs\n\n| Spec | Summary | Status |\n| --- | --- | --- |\n| [a](specs/a.md) | A | Draft |\n';

      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents'), { recursive: true });
      await writeFile(repo(SPECS_INDEX), custom);

      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS.filter((file) => file !== SPECS_INDEX))}` +
        `Already existed (skipped):\n${listing([SPECS_INDEX])}` +
        'AGENTS.md: appended Documentation section\n'
      );
      expect(await read(SPECS_INDEX)).toEqual(custom);
      expect(stderr.write).toHaveBeenCalledOnceWith(SPECS_INDEX_NOTE);
    });
  });

  describe('when docs/agents/specs/ holds a spec', () => {
    it('creates no .gitkeep and does not list it, still creating the index', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents/specs'), { recursive: true });
      await writeFile(repo('docs/agents/specs/auth.md'), '# Auth\n');

      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS.filter((file) => file !== SPECS_GITKEEP))}` +
        'AGENTS.md: appended Documentation section\n'
      );
      await expectAsync(stat(repo(SPECS_GITKEEP))).toBeRejected();
      expect(stderr.write).not.toHaveBeenCalled();
    });

    it('counts hidden entries', async () => {
      await mkdir(repo('docs/agents/specs'), { recursive: true });
      await writeFile(repo('docs/agents/specs/.hidden'), '');

      const output = await command.run();

      expect(output).not.toContain(SPECS_GITKEEP);
      await expectAsync(stat(repo(SPECS_GITKEEP))).toBeRejected();
    });
  });

  describe('when docs/agents/specs/ is an empty directory', () => {
    it('creates the .gitkeep', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents/specs'), { recursive: true });

      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS)}AGENTS.md: appended Documentation section\n`
      );
      expect(await read(SPECS_GITKEEP)).toEqual('\n');
    });
  });

  describe('when docs/agents/specs is a file', () => {
    it('leaves it alone, does not list the .gitkeep and warns', async () => {
      await writeFile(repo('AGENTS.md'), '# Agents\n');
      await mkdir(repo('docs/agents'), { recursive: true });
      await writeFile(repo('docs/agents/specs'), 'not a dir\n');

      await expectAsync(command.run()).toBeResolvedTo(
        `Created:\n${listing(PATHS.filter((file) => file !== SPECS_GITKEEP))}` +
        'AGENTS.md: appended Documentation section\n'
      );
      expect(await read('docs/agents/specs')).toEqual('not a dir\n');
      expect(stderr.write).toHaveBeenCalledOnceWith(SPECS_DIR_WARNING);
    });
  });

  describe('with an injected templatePath', () => {
    it('reads both templates through it', async () => {
      const templates = path.join(dir, 'templates');

      await mkdir(templates);
      await writeFile(path.join(templates, 'specs.md'), 'fake specs\n');
      await writeFile(path.join(templates, 'agents-documentation-section.md'), '## Documentation\n\nfake\n');
      await writeFile(repo('AGENTS.md'), '# Agents\n');

      const templatePath = jasmine.createSpy('templatePath').and.callFake((name) => path.join(templates, name));

      command = new InitClaudeSetupDocsStructure(new RepoContext({ repoPath: dir }), { stderr, templatePath });

      await command.run();

      expect(templatePath).toHaveBeenCalledWith('specs.md');
      expect(templatePath).toHaveBeenCalledWith('agents-documentation-section.md');
      expect(await read(SPECS_INDEX)).toEqual('fake specs\n');
      expect(await read('AGENTS.md')).toEqual('# Agents\n\n## Documentation\n\nfake\n');
    });
  });

  it('defaults to writing the warning to process.stderr', async () => {
    spyOn(process.stderr, 'write');
    command = new InitClaudeSetupDocsStructure(new RepoContext({ repoPath: dir }));

    await command.run();

    expect(process.stderr.write).toHaveBeenCalledWith(WARNING);
  });
});
