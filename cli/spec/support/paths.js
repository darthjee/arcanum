import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The cli/ directory. */
export const CLI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The repository root. */
export const REPO_ROOT = path.resolve(CLI_DIR, '..');
