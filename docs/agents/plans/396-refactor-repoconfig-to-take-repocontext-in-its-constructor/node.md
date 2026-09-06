# Node Plan: Refactor RepoConfig to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Steps

- [01 — Accept repoContext in the constructor](node/01-accept-repocontext-in-the-constructor.md)
- [02 — Migrate call sites](node/02-migrate-call-sites.md)
- [03 — Remove repoPath from method arguments](node/03-remove-repopath-from-method-arguments.md)

## Notes

- Each step must land with `make core-test` passing and `make core-lint` clean before
  moving to the next, since steps 2 and 3 depend on the previous step's public shape.
- Step 3 is a breaking change to `RepoConfig`'s public API — confirmed safe only because
  `SafeBranch` and `AutoFixAllWaitCi` (migrated in step 2) are its sole production
  callers.
