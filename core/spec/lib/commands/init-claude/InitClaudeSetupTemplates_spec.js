import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeSetupTemplates from '../../../../lib/commands/init-claude/InitClaudeSetupTemplates.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { resolveInstallPath } from '../../../../lib/utils/file/InstallRoot.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const NAMES = ['pull_request_template.md', 'commit_message_template.md', 'commit_message_template-2.0.md'];

describe('InitClaudeSetupTemplates', () => {
  let dir;
  let command;

  beforeEach(async () => {
    dir = await createTempDir();
    command = new InitClaudeSetupTemplates(new RepoContext({ repoPath: dir }));
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @param {string} name - a `.github/` entry name.
   * @returns {string} its path in the temp repo.
   */
  function github(name) {
    return path.join(dir, '.github', name);
  }

  it('creates .github/ and copies every template from the install', async () => {
    await expectAsync(command.run()).toBeResolvedTo(`Created: ${NAMES.join(' ')}\n`);

    for (const name of NAMES) {
      expect(await readFile(github(name), 'utf8'))
        .toEqual(await readFile(resolveInstallPath('init-claude', 'templates', name), 'utf8'));
    }
  });

  it('leaves existing templates untouched and lists them', async () => {
    await mkdir(path.join(dir, '.github'));
    await writeFile(github('commit_message_template.md'), 'custom');

    await expectAsync(command.run()).toBeResolvedTo(
      'Created: pull_request_template.md commit_message_template-2.0.md\n' +
      'Already present, left untouched: commit_message_template.md\n'
    );
    expect(await readFile(github('commit_message_template.md'), 'utf8')).toEqual('custom');
  });

  it('prints only the untouched line when everything is present', async () => {
    await command.run();

    await expectAsync(command.run()).toBeResolvedTo(
      `Already present, left untouched: ${NAMES.join(' ')}\n`
    );
  });

  it('copies into a directory at the destination path, like cp', async () => {
    await mkdir(github('pull_request_template.md'), { recursive: true });

    const output = await command.run();

    expect(output).toEqual(`Created: ${NAMES.join(' ')}\n`);
    await expectAsync(
      readFile(path.join(github('pull_request_template.md'), 'pull_request_template.md'), 'utf8')
    ).toBeResolved();
  });

  it('reads templates through the injected resolver', async () => {
    const source = path.join(dir, 'src.md');

    await writeFile(source, 'stub');
    command = new InitClaudeSetupTemplates(new RepoContext({ repoPath: dir }), { templatePath: () => source });

    await command.run();

    expect(await readFile(github('pull_request_template.md'), 'utf8')).toEqual('stub');
  });

  it('rejects when a template is missing from the install', async () => {
    command = new InitClaudeSetupTemplates(
      new RepoContext({ repoPath: dir }),
      { templatePath: (name) => path.join(dir, 'missing', name) }
    );

    await expectAsync(command.run()).toBeRejected();
  });
});
