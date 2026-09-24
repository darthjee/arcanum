import { EventEmitter } from 'node:events';
import MonitorIssuesMonitorIssues from '../../../lib/commands/monitor-issues/MonitorIssuesMonitorIssues.js';
import { createRepoContextMock } from './repoContextFactory.js';

export const REPO_REF = 'darthjee/arcanum';
export const NOW = new Date('2026-01-02T03:04:05.678Z');

/**
 * Build a `MonitorIssuesMonitorIssues` wired to fakes, running a single
 * cycle by default.
 * @param {string} repoPath - the (temp) repo path.
 * @param {object} [overrides] - per-test overrides.
 * @param {Array|Error} [overrides.issues] - the search result (or its
 *   rejection).
 * @param {object} [overrides.stored] - stored `updated_at` per issue id.
 * @param {string} [overrides.ghUser] - the configured `user.ghuser`.
 * @returns {object} the command plus its fakes and captured output.
 */
export function createMonitor(repoPath, { issues = [], stored = {}, ghUser = '', ...rest } = {}) {
  const out = [];
  const err = [];
  const issueClient = {
    searchOpenIssuesUpdatedSince: jasmine.createSpy('search').and.callFake(async () => {
      if (issues instanceof Error) {
        throw issues;
      }

      return issues;
    })
  };
  const issueStateService = {
    get: jasmine.createSpy('get').and.callFake(async (id) => stored[id] || ''),
    set: jasmine.createSpy('set').and.resolveTo(undefined),
    setJson: jasmine.createSpy('setJson').and.resolveTo(undefined)
  };
  const rewriteQueue = { push: jasmine.createSpy('rewritePush').and.callFake(async (id) => `Pushed: ${id}\n`) };
  const autoFixQueue = { push: jasmine.createSpy('autoFixPush').and.resolveTo(undefined) };
  const githubToken = { ghUser: jasmine.createSpy('ghUser').and.resolveTo(ghUser) };
  const processRef = new EventEmitter();
  const repoContext = createRepoContextMock({
    repoPath,
    origin: { resolveWithRef: jasmine.createSpy().and.resolveTo({ repoRef: REPO_REF }) }
  });
  const deps = {
    issueClient,
    issueStateService,
    rewriteQueue,
    autoFixQueue,
    githubToken,
    processRef,
    clock: () => NOW,
    sleepFn: jasmine.createSpy('sleep').and.resolveTo(undefined),
    maxCycles: 1,
    stdout: { write: (chunk) => out.push(chunk) },
    stderr: { write: (chunk) => err.push(chunk) },
    exitFn: jasmine.createSpy('exit'),
    ...rest
  };

  return {
    monitor: new MonitorIssuesMonitorIssues(repoContext, deps),
    ...deps,
    stdout: () => out.join(''),
    stderr: () => err.join('')
  };
}

/**
 * @param {string} message - the log message.
 * @returns {string} the log line, timestamped with `NOW`.
 */
export function logLine(message) {
  return `[2026-01-02T03:04:05Z] ${message}\n`;
}
