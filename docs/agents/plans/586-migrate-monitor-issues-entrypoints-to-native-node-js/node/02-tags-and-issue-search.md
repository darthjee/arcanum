# Port actionable_tags and add issue search

- `Tags.actionableTags(labelNames)`: native port of `arcanum/_lib/tag_actions.sh`'s `actionable_tags`. It returns the subset of `['question', 'created', 'ready_for_work']` that is present, in that fixed order, and uses the same `has_tag` matching as `Tags.extractTags`.
- Issue search: add a method to `utils/github/IssueClient.js` (or a small new client on `GitHubTransport`) that matches `gh issue list -R <repo> [--author <user>] --state open --json number,title,updatedAt,labels --search "updated:>SINCE" --limit 100`. Use `GET /search/issues?q=repo:<owner>/<name>+is:issue+is:open[+author:<user>]+updated:>SINCE&per_page=100`, and map `items` to `{ number, title, updatedAt, labels: [{ name }] }`. Search is how `gh issue list --search` itself works. `is:issue` is needed so PRs are excluded, as `gh issue list` does.
- GitHub user: native equivalent of `get_gh_user`, i.e. `git config user.ghuser`, falling back to `git config --global user.ghuser`, else empty. Reuse `utils/git/Git.js`/`GitClient.js` if either already exposes config reads. `_ensure_gh_user`'s `gh auth switch` has no native equivalent. Token resolution already goes through `RepoContext#getToken`/`GithubToken.js`, so check it respects `user.ghuser` and write down the result.

## Files to Change
- `core/lib/utils/issue/Tags.js` — `actionableTags`
- `core/lib/utils/github/IssueClient.js` (or new client) — issue search
- `core/lib/utils/git/*` — ghuser config read, only if not already available
- matching specs under `core/spec/lib/`
