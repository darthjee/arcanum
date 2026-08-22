# Add `info` to GithubIssue.js

Add an `info(repoPath)` method to `core/lib/GithubIssue.js`, mirroring `github_issue.sh`'s `cmd_info`:

```js
async info(repoPath) {
  const { domain, repo } = await this._origin.resolve(repoPath);

  return `DOMAIN=${domain}\nREPO=${repo}\n`;
}
```

- No `RepoPath` validation — the shell version doesn't call `repo_path_enter` for `info`, only `_load_origin` (whose own not-a-git-repo/no-origin failure is already reproduced by `Origin#resolve`'s existing error message). Adding validation here would diverge from the shell's actual behavior/error text.
- Reuses the existing `this._origin` collaborator (`Origin.js`) already injected in the constructor — no new constructor dependency needed for this step.
- Returns a **string**, not an object — this is what `core/bin/arcanum`'s router prints verbatim to stdout (see Step 3).

## Files to Change

- `core/lib/GithubIssue.js` — add the `info` method and its JSDoc, matching the existing `fetch` method's doc style.
