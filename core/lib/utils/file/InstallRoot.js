import path from 'node:path';
import { fileURLToPath } from 'node:url';

// "Install root" is the arcanum skill repo's own top-level directory —
// the checkout that ships the sibling skill scripts, skill templates and
// `arcanum/_lib/*.sh` that native `core/lib/` modules shell out to. The
// fragile `..` walk back up to it lives here (once) so moving a consumer
// module never silently rebreaks resolution. `core/lib/utils/file/` is
// four levels below the repo root.
const INSTALL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'
);

/**
 * Resolve a path inside the arcanum install (the skill repo itself),
 * never the target `repoPath` — this is the distinction #319 got wrong.
 * @param {...string} segments - path segments below the install root.
 * @returns {string} the absolute path `path.join(INSTALL_ROOT, ...segments)`.
 */
function resolveInstallPath(...segments) {
  return path.join(INSTALL_ROOT, ...segments);
}

export { INSTALL_ROOT, resolveInstallPath };
