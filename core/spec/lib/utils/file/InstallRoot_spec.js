import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALL_ROOT, resolveInstallPath } from '../../../../lib/utils/file/InstallRoot.js';

// Computed independently from this spec file's own location
// (`core/spec/lib/utils/file/` is five levels below the repo root)
// rather than trusting the module under test.
const EXPECTED_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..'
);

describe('InstallRoot', () => {
  describe('INSTALL_ROOT', () => {
    it('points at the arcanum install root', () => {
      expect(INSTALL_ROOT).toEqual(EXPECTED_ROOT);
    });

    it('contains no unresolved ".." segment', () => {
      expect(INSTALL_ROOT.split(path.sep)).not.toContain('..');
    });

    it('contains the arcanum/_lib/config_chain.sh install marker', async () => {
      await expectAsync(
        access(path.join(INSTALL_ROOT, 'arcanum', '_lib', 'config_chain.sh'))
      ).toBeResolved();
    });

    it('contains the auto-fix-all/templates/reply.tmpl.md install marker', async () => {
      await expectAsync(
        access(path.join(INSTALL_ROOT, 'auto-fix-all', 'templates', 'reply.tmpl.md'))
      ).toBeResolved();
    });
  });

  describe('resolveInstallPath', () => {
    it('joins the segments onto INSTALL_ROOT', () => {
      expect(resolveInstallPath('a', 'b', 'c.sh')).toEqual(
        path.join(INSTALL_ROOT, 'a', 'b', 'c.sh')
      );
    });

    it('returns INSTALL_ROOT when given no segments', () => {
      expect(resolveInstallPath()).toEqual(INSTALL_ROOT);
    });
  });
});
