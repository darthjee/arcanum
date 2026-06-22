# Loop through issues popping

## Context

When popping an issue from the queue in the `auto-fix-all` skill, if there are no more issues, the script currently exits and the whole skill ends. This means `auto-fix-all` cannot be left running to pick up issues pushed onto the queue after it started.

## What needs to be done

- Update the queue-popping logic in the `auto-fix-all` skill so that, when the queue is empty, the script waits 5 seconds and checks the queue again instead of exiting.
- Repeat this wait-and-recheck behavior indefinitely (an eternal loop), so the skill only stops when explicitly terminated, never on its own due to an empty queue.

## Acceptance criteria

- [ ] When the queue has no more issues, the script sleeps 5 seconds and re-checks the queue instead of exiting.
- [ ] This wait-and-recheck behavior loops forever, allowing issues pushed to the queue later to still be picked up.

---
See issue for details: https://github.com/darthjee/arcanum/issues/28
