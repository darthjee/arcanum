# Base Branch Selection

## Ask the user for the base branch

Before doing anything else, run `git branch --show-current` to get the current branch name. Then ask:

```
What should be the base branch for this PR?

  1. Current branch (<current_branch>)
  2. main
  3. Other (please type the branch name)
```

Wait for the user's response and determine the target base branch:
- If they choose option 1: use `<current_branch>` as the base branch. No switch needed.
- If they choose option 2: use `main` as the base branch.
- If they choose option 3 or type a name: use the branch they typed as the base branch.

## Switch branch if needed

If the chosen base branch differs from the current branch:

Ask the user:

```
To proceed, I need to switch to branch '<base_branch>'. Can I do that now?
```

Wait for the user's response.

- If the user confirms (yes, sure, go ahead, or similar affirmative): run `git checkout <base_branch>` and continue with the rest of the skill.
- If the user declines: respond with:

```
I'm sorry, but I can't fix this issue without switching to '<base_branch>'. Please try again when you're able to switch branches.
```

Then stop.
