# Docs and spec update
- **`docs/agents/architecture/install-and-release.md`.** Add a `## npm package (arcanum-cli)` section covering:
  - what `publish-cli` does and when (after `build-and-release`, in parallel with `publish-image`);
  - the script's steps and `--dry-run` / `make cli-publish-dry-run`;
  - trusted publishing and provenance;
  - **one-time bootstrap**, for the package owner:
    1. run `make cli-publish-dry-run`;
    2. from a clean checkout of a release tag, run `cd cli && yarn install --frozen-lockfile && npm publish`, logged in interactively;
    3. register the trusted publisher, on npmjs.com (package → Settings → Trusted Publisher → CircleCI) or with `npm trust`, using `--vcs-origin` for `darthjee/arcanum` and optionally `--context-id`;
    4. set the package's publishing access to disallow tokens;
  - **failure and recovery**: an auth failure before the bootstrap, registry lag, re-run from failed, no-op re-runs, and deprecating rather than unpublishing a broken version.
- **`docs/agents/specs/arcanum-cli/packaging-and-release.md`:**
  - Rewrite **Token storage** as "Authentication": trusted publishing over CircleCI OIDC, no long-lived token, the bootstrap, and the guard that refuses stray token env vars.
  - Rewrite **Provenance** as adopted: provenance is attached automatically by trusted publishing; npm ≥ 11.5.1 and Node ≥ 22.14.0 are required.
  - Update the Release step 6 wording (no temporary `.npmrc`).
  - Update **Supply chain → Narrow credentials**, the **Edge cases** row about the token, **Security**, and **Open points**: remove the trusted-publishing item, and record "pre-release channel" only if it is still open.
- **`docs/agents/architecture/agent-roster-and-delegation.md`.** In `infra`'s scope, replace "the `NPM_TOKEN` setup" with "the npm trusted-publisher setup".
- **`.claude/agents/infra.md`.** Update it if it mentions `NPM_TOKEN`; check with grep.

## Files to Change
- `docs/agents/architecture/install-and-release.md` — the new npm section.
- `docs/agents/specs/arcanum-cli/packaging-and-release.md` — the authentication and provenance decisions.
- `docs/agents/architecture/agent-roster-and-delegation.md` — `infra`'s scope wording.
- `.claude/agents/infra.md` — only if it mentions `NPM_TOKEN`.
