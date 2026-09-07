# Add repoContext to Origin's constructor

Give `Origin` (`core/lib/utils/git/Origin.js`) an optional constructor-injected
`repoContext` dependency, the same shape as `GithubToken`
(`core/lib/utils/github/GithubToken.js:23-26,34-35`) and `ConfigChain`. `resolve`
and `resolveWithRef` keep `repoPath` as their existing first parameter — it stays
required-in-practice but the code must tolerate it being omitted — falling back
to `this._repoContext?.repoPath` when it's not passed. An explicitly passed
`repoPath` always wins over the constructor-injected context.

Update the JSDoc on the constructor and both methods to document the new
`repoContext` param and the fallback/precedence, mirroring `GithubToken`'s
existing JSDoc phrasing exactly (`@param {import('../../context/RepoContext.js').default} [deps.repoContext]`).

`resolveWithRef` internally calls `this.resolve(repoPath)` and does not need its
own separate fallback — forwarding its own (possibly `undefined`) `repoPath`
straight through to `resolve` is sufficient, since `resolve` already applies the
merge.

## Files to Change

- `core/lib/utils/git/Origin.js` — constructor destructures `{ execFileAsync, repoContext }` and stores `this._repoContext = repoContext`; `resolve(repoPath)` computes `const path = repoPath ?? this._repoContext?.repoPath;` and uses `path` everywhere it currently uses `repoPath` (the `execFile` call, both error messages); `resolveWithRef(repoPath)` is unchanged except its JSDoc.
