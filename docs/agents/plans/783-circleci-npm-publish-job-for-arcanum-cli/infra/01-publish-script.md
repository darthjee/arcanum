# Publish script and its test
Add `scripts/publish_cli_package.sh <tag> [--dry-run]`, following `scripts/publish_runtime_image.sh`'s style: a header comment describing usage and behaviour, `set -euo pipefail`, no `set -x`, `cd "$REPO_ROOT/cli"`. Steps, each failing the script on error:

0. **Preflight:**
   - The tag must match `^[0-9]+\.[0-9]+\.[0-9]+$`; anything else, including a pre-release, exits 1.
   - `node` must be ≥ 22.14.0 and `npm` must be ≥ 11.5.1, compared as numeric version triples in bash.
   - Unless `--dry-run`:
     - refuse when `NPM_TOKEN` or `NODE_AUTH_TOKEN` is set (OIDC only);
     - require `CIRCLE_OIDC_TOKEN_V2` (or `CIRCLE_OIDC_TOKEN`) to be set, with a message pointing at the trusted-publisher bootstrap doc.
1. **Version check.** `node -p "require('./package.json').version"` must equal the tag.
2. **Already published?** Skipped on `--dry-run`. If `npm view "arcanum-cli@${TAG}" version` prints the tag, echo that the version is already published and exit 0.
3. `yarn install --frozen-lockfile`.
4. `yarn lint`, `yarn build`, then `yarn test`.
5. **Content check.** `npm pack --dry-run --json`, with the file paths extracted through `node -e`. The sorted list must equal exactly `README.md`, `bin/arcanum`, `dist/arcanum.mjs` and `package.json`; on a mismatch, print both lists and exit 1.
6. **Publish.**
   - Normally: `npm publish`. With no token present, npm uses the CircleCI OIDC identity and attaches provenance itself; `publishConfig` already pins `access: public` and `tag: latest`.
   - With `--dry-run`: `npm publish --dry-run`.
7. **Verify.** Skipped on `--dry-run`. Poll `npm view "arcanum-cli@${TAG}" version` every 5 s for up to 60 s until it prints the tag, then print `npm view "arcanum-cli@${TAG}" dist.integrity`. On timeout, exit 1 with a "registry lag; re-run" message.

Add `scripts/test_publish_cli_package.sh` in the same style as `scripts/test_bump_version.sh`.
- **Fixtures.** Build a temp fixture repo containing:
  - a copy of the script;
  - a minimal `cli/package.json`;
  - stub `npm`, `node` (or the real `node`), `yarn` and `sleep` executables on `PATH`, which log their calls and return scripted outputs.
- **Cases:**
  - a non-bare tag;
  - a version mismatch;
  - npm too old;
  - a token env var present on a real publish;
  - the OIDC variable missing on a real publish;
  - already published (exit 0, no publish call);
  - a dry run (`npm publish --dry-run`, no `npm view`);
  - a wrong pack file list;
  - the happy path (publish called once, verify retried until success);
  - a verify timeout.

## Files to Change
- `scripts/publish_cli_package.sh` — new, executable.
- `scripts/test_publish_cli_package.sh` — new, executable.
