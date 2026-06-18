#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
templates_dir="$script_dir/../templates"

mkdir -p .github

created=()
skipped=()

for name in pull_request_template.md commit_message_template.md; do
  dest=".github/$name"
  if [ -f "$dest" ]; then
    skipped+=("$name")
  else
    cp "$templates_dir/$name" "$dest"
    created+=("$name")
  fi
done

if [ ${#created[@]} -gt 0 ]; then
  echo "Created: ${created[*]}"
fi
if [ ${#skipped[@]} -gt 0 ]; then
  echo "Already present, left untouched: ${skipped[*]}"
fi
