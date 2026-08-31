# Remove DispatchFixture.js's run() method

`DispatchFixture.js` currently backs both `dispatch-fixture` (`run()`) and `dispatch-fixture-crash` (`crash()`). Remove `run()`, keep `crash()` and the class itself (it's still the module backing `dispatch-fixture-crash`). Update the class-level doc comment: it currently describes the class as proving "shell/native dispatch guard's output/exit-code parity contract end to end" and being "not deleted once #192 lands" — rewrite it to describe the class as backing only the `dispatch-fixture-crash` crash-survival proof now that the parity proof lives elsewhere (see [plan.md](../plan.md)'s "Shared contracts").

Update `core/spec/lib/commands/shared/DispatchFixture_spec.js` to match: remove its coverage of `run()`, keep its coverage of `crash()`.

## Files to Change

- `core/lib/commands/shared/DispatchFixture.js` — remove `run()`; rewrite the class-level doc comment.
- `core/spec/lib/commands/shared/DispatchFixture_spec.js` — remove the `run()` describe/it block(s); keep the `crash()` ones.
