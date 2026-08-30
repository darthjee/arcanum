import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ListAgents from '../../../lib/commands/ListAgents.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';

/**
 * @param {string} dir - the directory to write the agent file into.
 * @param {string} filename - the agent file's name (e.g. `a-agent.md`).
 * @param {string} content - the file's full content.
 * @returns {Promise<void>} resolves once the file is written.
 */
async function writeAgentFile(dir, filename, content) {
  await writeFile(path.join(dir, filename), content);
}

/**
 * @param {string} repoPath - the context's target repo path.
 * @returns {ListAgents} a `ListAgents` bound to a real `RepoContext`.
 */
function listAgentsFor(repoPath) {
  return new ListAgents(new RepoContext({ repoPath }));
}

describe('ListAgents', () => {
  describe('#run', () => {
    let repo;

    afterEach(async () => {
      if (repo) {
        await repo.cleanup();
        repo = undefined;
      }
    });

    it('lists multiple valid agent files, ordered alphabetically by filename', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(
        agentsDir,
        'a-first.md',
        '---\nname: zebra\ndescription: last alphabetically by name\n---\nbody\n'
      );
      await writeAgentFile(
        agentsDir,
        'z-second.md',
        '---\nname: apple\ndescription: first alphabetically by name\n---\nbody\n'
      );

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual(
        'zebra|last alphabetically by name\napple|first alphabetically by name\n'
      );
    });

    it('skips a file missing the name: field entirely', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(agentsDir, 'no-name.md', '---\ndescription: no name here\n---\nbody\n');
      await writeAgentFile(agentsDir, 'valid.md', '---\nname: valid\ndescription: has a name\n---\nbody\n');

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('valid|has a name\n');
    });

    it('emits name| (empty description) when description: is missing', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(agentsDir, 'no-description.md', '---\nname: solo\n---\nbody\n');

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('solo|\n');
    });

    it('strips surrounding single and double quotes from frontmatter values', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(
        agentsDir,
        'single.md',
        '---\nname: \'single-quoted\'\ndescription: \'single-quoted desc\'\n---\nbody\n'
      );
      await writeAgentFile(
        agentsDir,
        'double.md',
        '---\nname: "double-quoted"\ndescription: "double-quoted desc"\n---\nbody\n'
      );

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('double-quoted|double-quoted desc\nsingle-quoted|single-quoted desc\n');
    });

    it('skips a file with no --- frontmatter block at all', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(agentsDir, 'no-frontmatter.md', 'name: not-frontmatter\ndescription: nope\n');
      await writeAgentFile(agentsDir, 'valid.md', '---\nname: valid\ndescription: has one\n---\nbody\n');

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('valid|has one\n');
    });

    it('resolves to \'\' when agentsDir doesn\'t exist', async () => {
      repo = await createGitFixtureRepo();

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run('.claude/agents');

      expect(output).toEqual('');
    });

    it('resolves to \'\' when agentsDir exists but has zero *.md files', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(agentsDir, 'not-markdown.txt', 'name: nope\n');

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('');
    });

    it('defaults agentsDir to .claude/agents under repoPath when omitted', async () => {
      repo = await createGitFixtureRepo();
      const agentsDir = path.join(repo.repoPath, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeAgentFile(agentsDir, 'default-dir.md', '---\nname: defaulted\ndescription: default dir\n---\nbody\n');

      const listAgents = listAgentsFor(repo.repoPath);
      const output = await listAgents.run();

      expect(output).toEqual('defaulted|default dir\n');
    });
  });
});
