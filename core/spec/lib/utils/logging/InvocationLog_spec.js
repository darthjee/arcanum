import { buildInvocationLog, CONFIG_CHAIN_PATH } from '../../../support/utils/logging/invocationLogHarness.js';

describe('InvocationLog', () => {
  describe('#record', () => {
    it('resolves the location and appends the expected log line', async () => {
      const { invocationLog, appendFileSpy } = buildInvocationLog();

      await invocationLog.record('list-agents');

      expect(appendFileSpy).toHaveBeenCalledTimes(1);
      const [logFile, line] = appendFileSpy.calls.argsFor(0);

      expect(logFile).toEqual('/var/log/arcanum/arcanum-my-repo-log.txt');
      expect(line).toMatch(/^command list-agents invoked at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n$/);
    });

    it('no-ops (never appends) when ARCANUM_REPO_PATH is absent', async () => {
      const { invocationLog, execFileSpy, appendFileSpy } = buildInvocationLog({ env: {} });

      await invocationLog.record('list-agents');

      expect(execFileSpy).not.toHaveBeenCalled();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('no-ops when execFileAsync resolves with an empty/unset location', async () => {
      const { invocationLog, appendFileSpy } = buildInvocationLog({
        execFileAsync: () => Promise.resolve({ stdout: '\n', stderr: '' })
      });

      await invocationLog.record('list-agents');

      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('swallows silently (resolves, does not throw) when execFileAsync rejects', async () => {
      const { invocationLog, appendFileSpy } = buildInvocationLog({
        execFileAsync: () => Promise.reject(new Error('boom'))
      });

      await expectAsync(invocationLog.record('list-agents')).toBeResolved();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('swallows silently when appendFileAsync rejects', async () => {
      const { invocationLog } = buildInvocationLog({
        appendFileAsync: () => Promise.reject(new Error('disk full'))
      });

      await expectAsync(invocationLog.record('list-agents')).toBeResolved();
    });

    it('passes repoPath/configChainPath as separate args array elements, never interpolated into the script string', async () => {
      const { invocationLog, execFileSpy } = buildInvocationLog();

      await invocationLog.record('list-agents');

      expect(execFileSpy).toHaveBeenCalledTimes(1);
      const [file, args, options] = execFileSpy.calls.argsFor(0);

      expect(file).toEqual('bash');
      expect(args[0]).toEqual('-c');
      expect(typeof args[1]).toEqual('string');
      expect(args[1]).not.toContain('/repo/my-repo');
      expect(args[1]).not.toContain(CONFIG_CHAIN_PATH);
      expect(args.slice(-2)).toEqual([CONFIG_CHAIN_PATH, '/repo/my-repo']);
      expect(options).toEqual({ cwd: '/repo/my-repo' });
    });
  });
});
