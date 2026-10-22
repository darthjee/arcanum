import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import InitClaudeSetNextStepClear from '../../../../lib/commands/init-claude/InitClaudeSetNextStepClear.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import RepoConfigWriter from '../../../../../shared/lib/config/RepoConfigWriter.js';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('InitClaudeSetNextStepClear', () => {
  let dir;
  let command;
  let configFile;

  beforeEach(async () => {
    dir = await createTempDir();
    configFile = path.join(dir, '.claude', 'configuration', 'arcanum-repo-config.json');
    command = new InitClaudeSetNextStepClear(
      new RepoContext({ repoPath: dir }),
      { writer: new RepoConfigWriter({ lock: new Lock({ sleepMs: 5 }) }) }
    );
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  /**
   * @returns {Promise<object>} the parsed repo config.
   */
  async function writtenConfig() {
    return JSON.parse(await readFile(configFile, 'utf8'));
  }

  ['enhance-issue', 'discuss-issue', 'auto-plan-issue'].forEach((skill) => {
    ['true', 'false'].forEach((value) => {
      it(`writes next_step.clear.${skill} = ${value} and prints it`, async () => {
        await expectAsync(command.run(skill, value)).toBeResolvedTo(`NEXT_STEP_CLEAR=${skill}=${value}\n`);
        expect(await writtenConfig()).toEqual({ next_step: { clear: { [skill]: value === 'true' } } });
      });
    });
  });

  it('creates the file and its folder when they are missing', async () => {
    expect(existsSync(path.dirname(configFile))).toBeFalse();

    await command.run('enhance-issue', 'true');

    expect(await readFile(configFile, 'utf8')).toEqual(
      '{\n  "next_step": {\n    "clear": {\n      "enhance-issue": true\n    }\n  }\n}\n'
    );
  });

  it('keeps existing keys and sibling skills', async () => {
    await mkdir(path.dirname(configFile), { recursive: true });
    await writeFile(configFile, JSON.stringify({
      version: '1.0.0',
      next_step: { clear: { 'discuss-issue': true } }
    }));

    await command.run('enhance-issue', 'false');

    expect(await writtenConfig()).toEqual({
      version: '1.0.0',
      next_step: { clear: { 'discuss-issue': true, 'enhance-issue': false } }
    });
  });

  it('leaves next_step.auto.* untouched', async () => {
    await mkdir(path.dirname(configFile), { recursive: true });
    await writeFile(configFile, JSON.stringify({ next_step: { auto: { 'enhance-issue': true } } }));

    await command.run('enhance-issue', 'true');

    expect(await writtenConfig()).toEqual({
      next_step: { auto: { 'enhance-issue': true }, clear: { 'enhance-issue': true } }
    });
  });

  it('uses its own usage line', async () => {
    await expectAsync(command.run()).toBeRejectedWithError(
      'Usage: set_next_step_clear.sh <repo_path> <skill> <true|false>'
    );
  });

  it('overwrites a previously written value', async () => {
    await command.run('auto-plan-issue', 'true');
    await command.run('auto-plan-issue', 'false');

    expect(await writtenConfig()).toEqual({ next_step: { clear: { 'auto-plan-issue': false } } });
  });

  [[], ['enhance-issue'], ['', 'true']].forEach((args) => {
    it(`rejects with a usage error for args ${JSON.stringify(args)}`, async () => {
      await expectAsync(command.run(...args)).toBeRejectedWithError(/^Usage: /);
      expect(existsSync(configFile)).toBeFalse();
    });
  });

  it('rejects an unknown skill without writing', async () => {
    await expectAsync(command.run('auto-fix-issue', 'true')).toBeRejectedWithError(
      'unknown skill \'auto-fix-issue\': expected one of enhance-issue, discuss-issue, auto-plan-issue'
    );
    expect(existsSync(configFile)).toBeFalse();
  });

  ['yes', 'TRUE', '1', 'toString'].forEach((value) => {
    it(`rejects the value '${value}' without writing`, async () => {
      await expectAsync(command.run('enhance-issue', value)).toBeRejectedWithError(
        `invalid value '${value}': expected true or false`
      );
      expect(existsSync(configFile)).toBeFalse();
    });
  });
});
