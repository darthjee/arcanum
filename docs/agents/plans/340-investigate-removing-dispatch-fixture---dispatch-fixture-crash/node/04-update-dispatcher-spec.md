# Re-anchor dispatcher_spec.js's context:'none' proof

`core/spec/lib/core/dispatcher_spec.js`'s `'context: 'none' path (dispatch-fixture)'` describe block currently constructs `new Dispatcher('dispatch-fixture', ['/would/blow/up', 'x'])` and asserts: the module is constructed with no `RepoContext` argument, no `RepoContext` is ever constructed, and `dispatch()` returns `'dispatch-fixture: ok\n'`.

Re-anchor this block on `auto-fix-all-config-get` — the same command `scripter` uses for `test_engine_dispatch.sh`'s parity cases (see [plan.md](../plan.md)'s "Shared contracts"). Rewrite the assertions to that command's real contract: `Dispatcher('auto-fix-all-config-get', [<repo_path>, <key>])`, still proving no `RepoContext` is constructed (this command is `context: 'none'`, so the leading arg is *not* stripped/bound the way `context: 'repo'` entries are), and that `dispatch()` resolves per `AutoFixAllConfig#get`'s real return contract (`` `${value}\n` ``) for a seeded/unseeded key as appropriate — reuse the same fixture-seeding shape `scripter` uses (a temp repo, git-initialized, with `.claude/configuration/arcanum-repo-config.json` seeded).

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — rewrite the `'context: 'none' path'` describe block (and its three `it`s) to use `'auto-fix-all-config-get'` instead of `'dispatch-fixture'`.
