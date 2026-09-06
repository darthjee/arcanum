# Node Plan: Refactor QueueStore to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Steps

- [01 — Accept repoContext in the constructor](node/01-accept-repocontext-in-the-constructor.md)
- [02 — Migrate AutoFixAllQueue call sites](node/02-migrate-autofixallqueue-call-sites.md)
- [03 — Remove repoPath from method arguments](node/03-remove-repopath-from-method-arguments.md)

## Notes

- Each step must land with `make core-test` passing and `make core-lint` clean before
  moving to the next, since steps 2 and 3 depend on the previous step's public shape.
- Step 3 is a breaking change to `QueueStore`'s public API — confirmed safe only because
  `AutoFixAllQueue` (migrated in step 2) is its sole production caller.
