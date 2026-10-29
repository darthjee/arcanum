import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CoauthorTrailers from '../../../../lib/utils/git/CoauthorTrailers.js';
import { fakeConfigChain } from '../../../support/factories/commitCommandFixtures.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const AGENT = 'node';
const MODEL_NAME = 'Node Model';
const MODEL_EMAIL = 'model@example.com';
const MODEL_LINE = `Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>`;
const NEW_TEMPLATE = 'commit_message_template-2.0.md';
const OLD_TEMPLATE = 'commit_message_template.md';

describe('CoauthorTrailers', () => {
  let repoPath;

  /**
   * @param {string} name - the `.github/` template file to seed.
   * @returns {Promise<void>} resolves once written.
   */
  async function writeTemplate(name) {
    await mkdir(path.join(repoPath, '.github'), { recursive: true });
    await writeFile(path.join(repoPath, '.github', name), 'template\n');
  }

  /**
   * @param {object} configChainOpts - `fakeConfigChain`'s opts.
   * @returns {Promise<string[]>} the built trailer lines.
   */
  function linesFor(configChainOpts) {
    const configChain = fakeConfigChain(configChainOpts);

    return new CoauthorTrailers({ configChain }).lines(repoPath, AGENT, MODEL_NAME, MODEL_EMAIL);
  }

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#lines', () => {
    describe('when omit_model_coauthor is unset', () => {
      it('returns the model line and the agent line with the configured email', async () => {
        expect(await linesFor({ agentEmail: 'node@example.com' })).toEqual([
          MODEL_LINE,
          'Co-Authored-By: node agent <node@example.com>'
        ]);
      });

      it('falls back to the model email for the agent line', async () => {
        expect(await linesFor({})).toEqual([
          MODEL_LINE,
          `Co-Authored-By: node agent <${MODEL_EMAIL}>`
        ]);
      });
    });

    describe('when omit_model_coauthor is false', () => {
      it('keeps the model line', async () => {
        expect(await linesFor({ omitModelCoauthor: false })).toContain(MODEL_LINE);
      });

      it('keeps the model line for the string "false"', async () => {
        expect(await linesFor({ omitModelCoauthor: 'false' })).toContain(MODEL_LINE);
      });
    });

    [true, 'true'].forEach((omitModelCoauthor) => {
      describe(`when omit_model_coauthor is ${JSON.stringify(omitModelCoauthor)}`, () => {
        it('drops the model line, keeping a configured agent line', async () => {
          expect(await linesFor({ agentEmail: 'node@example.com', omitModelCoauthor })).toEqual([
            'Co-Authored-By: node agent <node@example.com>'
          ]);
        });

        it('drops the agent line too when its email falls back to the model email', async () => {
          expect(await linesFor({ omitModelCoauthor })).toEqual([]);
        });

        it('drops the agent line too when its configured email equals the model email', async () => {
          expect(await linesFor({ agentEmail: MODEL_EMAIL, omitModelCoauthor })).toEqual([]);
        });
      });
    });

    describe('commit template engine', () => {
      it('resolves the agent email via config when the new template exists', async () => {
        await writeTemplate(NEW_TEMPLATE);

        expect(await linesFor({ agentEmail: 'node@example.com' })).toContain(
          'Co-Authored-By: node agent <node@example.com>'
        );
      });

      it('prefers the new template when both exist', async () => {
        await writeTemplate(NEW_TEMPLATE);
        await writeTemplate(OLD_TEMPLATE);

        expect(await linesFor({ agentEmail: 'node@example.com' })).toContain(
          'Co-Authored-By: node agent <node@example.com>'
        );
      });

      it('uses the model email, ignoring config, when only the old template exists', async () => {
        await writeTemplate(OLD_TEMPLATE);

        expect(await linesFor({ agentEmail: 'node@example.com' })).toEqual([
          MODEL_LINE,
          `Co-Authored-By: node agent <${MODEL_EMAIL}>`
        ]);
      });

      it('drops every line under the old template when the model co-author is omitted', async () => {
        await writeTemplate(OLD_TEMPLATE);

        expect(await linesFor({ agentEmail: 'node@example.com', omitModelCoauthor: true })).toEqual([]);
      });

      it('defaults to the new engine when neither template exists', async () => {
        expect(await linesFor({ agentEmail: 'node@example.com' })).toContain(
          'Co-Authored-By: node agent <node@example.com>'
        );
      });
    });

    it('uses an injected fileExists collaborator', async () => {
      const fileExists = jasmine.createSpy('fileExists').and.callFake(async (filePath) => filePath.endsWith(OLD_TEMPLATE));
      const configChain = fakeConfigChain({ agentEmail: 'node@example.com' });
      const trailers = new CoauthorTrailers({ configChain, fileExists });

      expect(await trailers.lines(repoPath, AGENT, MODEL_NAME, MODEL_EMAIL)).toEqual([
        MODEL_LINE,
        `Co-Authored-By: node agent <${MODEL_EMAIL}>`
      ]);
    });
  });
});
