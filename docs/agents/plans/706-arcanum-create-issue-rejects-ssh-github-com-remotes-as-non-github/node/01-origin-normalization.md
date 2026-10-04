# Add shared GitHub domain normalization to Origin

In `core/lib/utils/git/Origin.js`, add one source of truth for GitHub host aliases:

- A module-level alias map, `GITHUB_DOMAIN_ALIASES = { 'ssh.github.com': 'github.com' }`, with a comment explaining that GitHub's SSH-over-443 host has no web UI or API of its own.
- A static `Origin.normalizeDomain(domain)` that returns the aliased domain, or `domain` unchanged when it has no alias. Optionally add a static `Origin.isGithub(domain)` that returns `normalizeDomain(domain) === 'github.com'`.
- `resolve()` keeps returning the raw `domain`. Leave it unchanged.
- `resolveWithRef()`: decide whether repoRef is bare with the normalized domain, so `ssh.github.com` gives a bare `<owner>/<repo>`. The returned `domain` stays raw, so `AutoFixIssueGithub#info` still prints `DOMAIN=ssh.github.com`.
- Update the `resolveWithRef` JSDoc. It no longer fully mirrors `origin.sh` `get_repo_ref`: for `ssh.github.com` remotes, Node returns the bare form while bash still domain-qualifies it (issue #453; bash is out of scope).

Specs in `core/spec/lib/utils/git/Origin_spec.js`:
- Add an `#resolve` case for `ssh://git@ssh.github.com:443/darthjee/arcanum.git` that expects `{ domain: 'ssh.github.com', repo: 'darthjee/arcanum' }`.
- Add a `#resolveWithRef` case: an `ssh.github.com` origin gives the bare repoRef `darthjee/arcanum`, with raw domain `ssh.github.com`.
- Keep the existing "domain-qualifies the repoRef for a non-github.com origin" case. An enterprise host is still qualified.
- Add specs for `Origin.normalizeDomain` (and `isGithub` if added): alias mapped, `github.com` unchanged, unknown host unchanged.

## Files to Change
- `core/lib/utils/git/Origin.js` — alias map, `normalizeDomain` (+ optional `isGithub`), and `resolveWithRef` using the normalized domain
- `core/spec/lib/utils/git/Origin_spec.js` — new `ssh.github.com` and normalization cases
