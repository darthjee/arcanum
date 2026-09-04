# Extract shared spec helpers into a factory module

Create `core/spec/support/factories/autoFixAllWaitCi.js` holding named-export copies of the
four local helpers currently defined at the top of `AutoFixAllWaitCi_spec.js`:
`fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, and `stubRepoConfig` (plus the `REPO_PATH`,
`REPO`, `BRANCH`, `TOKEN` constants they close over). Copy the bodies and JSDoc verbatim — no
behavior change. Follow the export style of the sibling `core/spec/support/factories/
autoFixAllQueue.js` (named exports, no default export, no barrel/index file).

`AutoFixAllWaitCi_spec.js` itself is **not** touched in this step — it keeps its own local
copies of the helpers until step 05 deletes the whole file. This step only adds the new module
so steps 02–04 have something to import from.

## Files to Change

- `core/spec/support/factories/autoFixAllWaitCi.js` — new file; `fakeExecFileAsync`, `fakeFetch`,
  `newWaitCi`, `stubRepoConfig`, and the four constants, copied verbatim from
  `AutoFixAllWaitCi_spec.js` (core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCi_spec.js:1-123)
  as named exports.
