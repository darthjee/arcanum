# Use the normalization in GithubPreflight

In `core/lib/commands/arcanum-create-issue/GithubPreflight.js`, replace the strict `domain !== GITHUB_DOMAIN` check with the shared helper from step 01 (`!Origin.isGithub(domain)`, or `Origin.normalizeDomain(domain) !== 'github.com'`). Drop the local `GITHUB_DOMAIN` constant if nothing else uses it. The error message for a genuinely non-GitHub origin stays the same (`origin is not a GitHub remote: <domain>/<repo>`). Update the class doc comment to say that `ssh.github.com` counts as GitHub.

In `core/spec/lib/commands/arcanum-create-issue/GithubPreflight_spec.js`, add a case: an `ssh.github.com` origin with a token passes, and `getToken` is called. Keep the existing non-GitHub rejection case.

## Files to Change
- `core/lib/commands/arcanum-create-issue/GithubPreflight.js` — use the shared normalization
- `core/spec/lib/commands/arcanum-create-issue/GithubPreflight_spec.js` — `ssh.github.com` passes the preflight
