import path from 'node:path';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { REPO_ROOT } from '../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'confirm.sh');

// Routing spec for the real discuss-issue confirm.sh engine_dispatch
// shim (issue #745, docker batch 1), under engine.mode=shell, native
// and docker (a passthrough fake `docker`), for an affirmative and a
// negative reply.
describe('discuss-issue-confirm engine_dispatch routing (via the real confirm.sh shim)', () => {
  [{ reply: 'yes', code: 0 }, { reply: 'no', code: 1 }].forEach(({ reply, code }) => {
    itRoutesWithInvocationLog(`confirm.sh ${reply}`, SHIM_SCRIPT, {
      command: 'discuss-issue-confirm',
      prepare: async () => ({ args: [reply] }),
      check: (result) => {
        expect(result).toEqual({ stdout: '', stderr: '', code });
      },
      dockerArgs: () => [reply]
    });
  });
});
