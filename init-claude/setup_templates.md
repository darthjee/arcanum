# Setup PR and Commit Message Templates

Create `.github/pull_request_template.md` and `.github/commit_message_template.md` from the bundled templates, without overwriting either file if it already exists.

## Step 1 — Run the script

Run, resolving `scripts/setup_templates.sh` relative to this file's directory:

```bash
scripts/setup_templates.sh
```

The script creates `.github/` if needed, then copies each template from [templates/](templates/) into `.github/` only if the destination file does not already exist. Existing files are left untouched.

## Step 2 — Report the result

Relay the script's output to the user, then tell them:

```
GitHub will pick up pull_request_template.md automatically when opening PRs. The commit message template is a reference for the format agents and contributors should follow. Adapt either file to the project's conventions as needed.
```
