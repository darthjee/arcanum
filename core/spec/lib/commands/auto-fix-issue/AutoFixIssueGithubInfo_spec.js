import { createAutoFixIssueGithub, REPO } from '../../../support/factories/autoFixIssueGithub.js';

describe('AutoFixIssueGithub#info', () => {
  it('prints DOMAIN/REPO from the resolved origin', async () => {
    const github = createAutoFixIssueGithub();

    await expectAsync(github.info()).toBeResolvedTo(`DOMAIN=github.com\nREPO=${REPO}\n`);
  });
});
