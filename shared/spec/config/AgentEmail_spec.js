import AgentEmail from '../../lib/config/AgentEmail.js';
import ConfigChain from '../../lib/config/ConfigChain.js';
import {
  AGENT_EMAIL_FIXTURES,
  MODEL_EMAIL,
  seedAgentEmailTiers
} from '../support/fixtures/agentEmailFixtures.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('AgentEmail', () => {
  let repoPath;
  let globalDir;
  let agentEmail;

  beforeEach(async () => {
    repoPath = await createTempDir();
    globalDir = await createTempDir('arcanum-core-spec-global-');
    agentEmail = new AgentEmail({ configChain: new ConfigChain({ env: { CLAUDE_CONFIG_DIR: globalDir } }) });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(globalDir);
  });

  AGENT_EMAIL_FIXTURES.forEach(({ description, agent, tiers, expected, resolved }) => {
    describe(`when ${description}`, () => {
      beforeEach(async () => {
        await seedAgentEmailTiers(repoPath, globalDir, tiers);
      });

      it(`#get yields ${expected}`, async () => {
        await expectAsync(agentEmail.get(repoPath, agent, MODEL_EMAIL)).toBeResolvedTo(expected);
      });

      it('#resolve reports the value and its provenance', async () => {
        await expectAsync(agentEmail.resolve(repoPath, agent)).toBeResolvedTo(resolved);
      });
    });
  });

  it('inserts a "$&"-containing agent name verbatim into the {agent} placeholder', async () => {
    await seedAgentEmailTiers(repoPath, globalDir, { repo: { email: '{agent}@example.com' } });

    await expectAsync(agentEmail.get(repoPath, 'x$&$`y', MODEL_EMAIL)).toBeResolvedTo('x$&$`y@example.com');
  });

  it('stringifies a non-string value', async () => {
    await seedAgentEmailTiers(repoPath, globalDir, { repo: { email: 42 } });

    await expectAsync(agentEmail.resolve(repoPath, 'node'))
      .toBeResolvedTo({ email: '42', raw: '42', tier: 'repo', key: 'git.email' });
  });

  it('reads git.agents.<agent> then git.email through readWithSource', async () => {
    const configChain = { readWithSource: jasmine.createSpy('readWithSource').and.resolveTo(undefined) };

    await new AgentEmail({ configChain }).get('/repo', 'node', MODEL_EMAIL);

    expect(configChain.readWithSource).toHaveBeenCalledWith('/repo', 'git', 'agents.node', 'email');
  });

  it('defaults to a real ConfigChain', () => {
    expect(new AgentEmail()._configChain).toBeInstanceOf(ConfigChain);
  });
});
