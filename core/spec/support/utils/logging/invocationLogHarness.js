import InvocationLog from '../../../../lib/utils/logging/InvocationLog.js';

export const CONFIG_CHAIN_PATH = '/fake/arcanum/_lib/config_chain.sh';

const DEFAULT_ENV = { ARCANUM_REPO_PATH: '/repo/my-repo' };

/**
 * Build an `InvocationLog` wired to jasmine spies standing in for
 * `execFileAsync`/`appendFileAsync`, for specs that only vary the stubbed
 * behavior of those collaborators and the `env`.
 * @param {object} [overrides] - per-test overrides.
 * @param {(...args: unknown[]) => Promise<{ stdout: string, stderr: string }>} [overrides.execFileAsync] - fake implementation for the `execFileAsync` spy
 *   (defaults to resolving `{ stdout: '"/var/log/arcanum"\n', stderr: '' }`).
 * @param {(...args: unknown[]) => Promise<void>} [overrides.appendFileAsync] - fake implementation for the `appendFileAsync` spy
 *   (defaults to resolving `undefined`).
 * @param {object} [overrides.env] - the env passed to `InvocationLog` (defaults to `{ ARCANUM_REPO_PATH: '/repo/my-repo' }`).
 * @returns {{ invocationLog: InvocationLog, execFileSpy: jasmine.Spy, appendFileSpy: jasmine.Spy }} the instance and its spies.
 */
export function buildInvocationLog(overrides = {}) {
  const execFileSpy = jasmine
    .createSpy('execFileAsync')
    .and.callFake(overrides.execFileAsync ?? (() => Promise.resolve({ stdout: '"/var/log/arcanum"\n', stderr: '' })));
  const appendFileSpy = jasmine
    .createSpy('appendFileAsync')
    .and.callFake(overrides.appendFileAsync ?? (() => Promise.resolve()));
  const invocationLog = new InvocationLog({
    execFileAsync: execFileSpy,
    appendFileAsync: appendFileSpy,
    configChainPath: CONFIG_CHAIN_PATH,
    env: overrides.env ?? DEFAULT_ENV
  });

  return { invocationLog, execFileSpy, appendFileSpy };
}
