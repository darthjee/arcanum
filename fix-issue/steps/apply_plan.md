# Apply Plan

## Implement the plan step by step

Work through each implementation step in the plan sequentially. For each step:

1. Make the necessary code changes.
2. Commit atomically with a message that describes what that step does. Example:

   ```
   Add migration for users table

   Part of #<id> — <title>
   ```

Do not bundle unrelated changes into a single commit. Each commit should correspond to one logical step in the plan.

## Push after all commits

Once all steps have been implemented and committed, push the branch:

```bash
git push -u origin HEAD
```
