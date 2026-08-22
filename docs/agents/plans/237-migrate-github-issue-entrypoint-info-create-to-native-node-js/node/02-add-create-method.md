# Add `create` to GithubIssue.js

Add a `create(repoPath, title, file)` method to `core/lib/GithubIssue.js`, mirroring `github_issue.sh`'s `cmd_create` exactly.

## Constructor change

Add a `repoPath` collaborator (the `RepoPath` class, not to be confused with the `repoPath` string parameter methods take), following the exact pattern already used in `core/lib/SafeBranch.js`:

```js
import RepoPath from './RepoPath.js';
// ...
constructor({
  origin = new Origin(),
  githubToken = new GithubToken(),
  issueState = new IssueState(),
  repoPath = new RepoPath(),
  fetchFn = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  // ...
  this._repoPath = repoPath;
}
```

## `create` method

```js
async create(repoPath, title, file) {
  await this._repoPath.validate(repoPath);

  let rawBody;
  try {
    rawBody = await readFile(file, 'utf8');
  } catch {
    throw new Error(`Error: file not found: ${file}`);
  }
  // $(cat "$file") in bash strips ALL trailing newlines via command
  // substitution; the shell then re-adds exactly one via `printf '%s\n'`.
  // Match that exactly, in both the POST payload and the written file —
  // do not just pass the raw file contents through.
  const body = rawBody.replace(/\n+$/, '');

  const { domain, repo } = await this._origin.resolve(repoPath);
  const token = await this._githubToken.get(repoPath);

  let response;
  try {
    response = await this._fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(this._timeoutMs)
    });
  } catch {
    throw new Error(`Error: could not create issue on ${repo}`);
  }

  if (!response.ok) {
    throw new Error(`Error: could not create issue on ${repo}`);
  }

  const issue = await response.json();
  const id = this._rawString(issue.number);
  const normalized = this._normalizeTitle(title);
  const filePath = `${ISSUES_DIR}/${id}-${normalized}.md`;

  await mkdir(path.join(repoPath, ISSUES_DIR), { recursive: true });
  await writeFile(path.join(repoPath, filePath), `${body}\n`);

  return `ID=${id}\nTITLE=${title}\nFILE=${filePath}\nDOMAIN=${domain}\nREPO=${repo}\n`;
}
```

Notes on parity with `cmd_create`:
- Order of operations matters for error precedence: repo-path validation, then file-exists check, then origin resolution, then token, then the POST — matching the shell's exact sequence (`repo_path_enter` → `[[ -f "$file" ]]` → `_load_origin` → `get_github_token` → `curl`).
- Reuses the existing `_normalizeTitle` and `_rawString` private helpers already used by `fetch` — no duplication.
- No `IssueState` call anywhere in this method (see plan.md's shared contract).
- `import { readFile, mkdir, writeFile } from 'node:fs/promises';` — `readFile` is a new import here (`mkdir`/`writeFile` already exist).

## Files to Change

- `core/lib/GithubIssue.js` — add the `repoPath` constructor dependency and the `create` method.
