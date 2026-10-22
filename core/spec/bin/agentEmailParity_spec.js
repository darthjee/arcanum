import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  AGENT_EMAIL_FIXTURES,
  MODEL_EMAIL,
  seedAgentEmailTiers
} from '../support/fixtures/agentEmailFixtures.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Shell side of the agent-email parity table (issue #778): runs
// arcanum/_lib/agent_email.sh's `agent_email_get` against every row of
// the shared fixture table that shared/spec/config/AgentEmail_spec.js
// runs natively, so shell and native agree on every row (`null`, `""`,
// generic-beats-specific across tiers, `{agent}` substitution).

const execFileAsync = promisify(execFile);
const AGENT_EMAIL_LIB = path.join(REPO_ROOT, 'arcanum', '_lib', 'agent_email.sh');

/**
 * @param {string} repoPath - the repo to `cd` into (the ambient cwd
 *   `agent_email_get` reads from).
 * @param {string} globalDir - the `CLAUDE_CONFIG_DIR` to use.
 * @param {string} agent - the agent name.
 * @returns {Promise<string>} `agent_email_get`'s stdout.
 */
async function shellAgentEmail(repoPath, globalDir, agent) {
  const { stdout } = await execFileAsync('bash', [
    '-c',
    'cd "$1" && source "$2" && agent_email_get "$3" "$4"',
    'agent-email-parity', repoPath, AGENT_EMAIL_LIB, agent, MODEL_EMAIL
  ], { env: { ...process.env, CLAUDE_CONFIG_DIR: globalDir } });

  return stdout;
}

describe('agent_email_get shell parity', () => {
  let repoPath;
  let globalDir;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-core-spec-global-');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  AGENT_EMAIL_FIXTURES.forEach(({ description, agent, tiers, expected }) => {
    it(`prints ${expected} when ${description}`, async () => {
      await seedAgentEmailTiers(repoPath, globalDir, tiers);

      await expectAsync(shellAgentEmail(repoPath, globalDir, agent)).toBeResolvedTo(`${expected}\n`);
    });
  });
});
