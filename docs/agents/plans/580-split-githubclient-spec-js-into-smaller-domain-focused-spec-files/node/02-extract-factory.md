# Extract the GitHubClient spec factory
Create `core/spec/support/factories/githubClient.js`, modeled on `prOperations.js`:
- `export const REPO = 'darthjee/arcanum';` and `export const TOKEN = 'fake-token';`
- `export function newGitHubClient(fetchFn, git)` with the exact body of today's inline `newClient`: a `createRepoContextMock` whose `origin.resolveWithRef` resolves to `{ domain: 'github.com', repo: REPO, repoRef: REPO }` and whose `githubToken.get` resolves to `TOKEN`, returning `new GitHubClient({ context, fetchFn, timeoutMs: 5, git })`.
- Add a JSDoc block in the same style as the other factories.

## Files to Change
- `core/spec/support/factories/githubClient.js`: new factory (client builder plus the REPO/TOKEN constants).
