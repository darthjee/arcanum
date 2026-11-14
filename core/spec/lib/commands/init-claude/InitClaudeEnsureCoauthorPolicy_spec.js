import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import InitClaudeEnsureCoauthorPolicy, { POLICY_LINE } from '../../../../lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const BLOCK = `## Commit Attribution\n\n${POLICY_LINE}\n`;

describe('InitClaudeEnsureCoauthorPolicy', () => {
  let dir;
  let file;
  let command;

  beforeEach(async () => {
    dir = await createTempDir();
    file = path.join(dir, 'AGENTS.md');
    command = new InitClaudeEnsureCoauthorPolicy(new RepoContext({ repoPath: dir }));
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('prints no-agents-md and writes nothing when AGENTS.md is missing', async () => {
    await expectAsync(command.run()).toBeResolvedTo('COAUTHOR_POLICY=no-agents-md\n');
    await expectAsync(readFile(file, 'utf8')).toBeRejected();
  });

  it('leaves the file byte-identical when the line is present', async () => {
    const original = `# Title\n\n${POLICY_LINE}\n\n\nmore`;

    await writeFile(file, original);

    await expectAsync(command.run()).toBeResolvedTo('COAUTHOR_POLICY=present\n');
    expect(await readFile(file, 'utf8')).toEqual(original);
  });

  it('appends the block to a file with a trailing newline', async () => {
    await writeFile(file, '# Title\n');

    await expectAsync(command.run()).toBeResolvedTo('COAUTHOR_POLICY=added\n');
    expect(await readFile(file, 'utf8')).toEqual(`# Title\n\n${BLOCK}`);
  });

  it('appends the block to a file with no trailing newline', async () => {
    await writeFile(file, '# Title');

    await command.run();

    expect(await readFile(file, 'utf8')).toEqual(`# Title\n\n${BLOCK}`);
  });

  it('keeps exactly one blank line when the file ends with several', async () => {
    await writeFile(file, '# Title\n\n\n\n');

    await command.run();

    expect(await readFile(file, 'utf8')).toEqual(`# Title\n\n${BLOCK}`);
  });

  it('is idempotent', async () => {
    await writeFile(file, '# Title\n');

    await command.run();
    const first = await readFile(file, 'utf8');

    await expectAsync(command.run()).toBeResolvedTo('COAUTHOR_POLICY=present\n');
    expect(await readFile(file, 'utf8')).toEqual(first);
  });
});
