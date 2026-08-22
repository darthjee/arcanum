import InvocationLog from '../../lib/InvocationLog.js';

const CONFIG_CHAIN_PATH = '/fake/arcanum/_lib/config_chain.sh';

describe('InvocationLog', () => {
  describe('#record', () => {
    it('resolves the location and appends the expected log line', async () => {
      const execFileSpy = jasmine
        .createSpy('execFileAsync')
        .and.returnValue(Promise.resolve({ stdout: '"/var/log/arcanum"\n', stderr: '' }));
      const appendFileSpy = jasmine.createSpy('appendFileAsync').and.returnValue(Promise.resolve());
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: { ARCANUM_REPO_PATH: '/repo/my-repo' }
      });

      await invocationLog.record('list-agents');

      expect(appendFileSpy).toHaveBeenCalledTimes(1);
      const [logFile, line] = appendFileSpy.calls.argsFor(0);

      expect(logFile).toEqual('/var/log/arcanum/arcanum-my-repo-log.txt');
      expect(line).toMatch(/^command list-agents invoked at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n$/);
    });

    it('no-ops (never appends) when ARCANUM_REPO_PATH is absent', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync');
      const appendFileSpy = jasmine.createSpy('appendFileAsync');
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: {}
      });

      await invocationLog.record('list-agents');

      expect(execFileSpy).not.toHaveBeenCalled();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('no-ops when execFileAsync resolves with an empty/unset location', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.returnValue(Promise.resolve({ stdout: '\n', stderr: '' }));
      const appendFileSpy = jasmine.createSpy('appendFileAsync');
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: { ARCANUM_REPO_PATH: '/repo/my-repo' }
      });

      await invocationLog.record('list-agents');

      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('swallows silently (resolves, does not throw) when execFileAsync rejects', async () => {
      const execFileSpy = jasmine.createSpy('execFileAsync').and.returnValue(Promise.reject(new Error('boom')));
      const appendFileSpy = jasmine.createSpy('appendFileAsync');
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: { ARCANUM_REPO_PATH: '/repo/my-repo' }
      });

      await expectAsync(invocationLog.record('list-agents')).toBeResolved();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it('swallows silently when appendFileAsync rejects', async () => {
      const execFileSpy = jasmine
        .createSpy('execFileAsync')
        .and.returnValue(Promise.resolve({ stdout: '"/var/log/arcanum"\n', stderr: '' }));
      const appendFileSpy = jasmine.createSpy('appendFileAsync').and.returnValue(Promise.reject(new Error('disk full')));
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: { ARCANUM_REPO_PATH: '/repo/my-repo' }
      });

      await expectAsync(invocationLog.record('list-agents')).toBeResolved();
    });

    it('passes repoPath/configChainPath as separate args array elements, never interpolated into the script string', async () => {
      const execFileSpy = jasmine
        .createSpy('execFileAsync')
        .and.returnValue(Promise.resolve({ stdout: '"/var/log/arcanum"\n', stderr: '' }));
      const appendFileSpy = jasmine.createSpy('appendFileAsync').and.returnValue(Promise.resolve());
      const invocationLog = new InvocationLog({
        execFileAsync: execFileSpy,
        appendFileAsync: appendFileSpy,
        configChainPath: CONFIG_CHAIN_PATH,
        env: { ARCANUM_REPO_PATH: '/repo/my-repo' }
      });

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
