# Plan: discuss-issue render_issue expands $ patterns in section text

Issue: [801-discuss-issue-render-issue-expands-patterns-in-section-text.md](../../issues/801-discuss-issue-render-issue-expands-patterns-in-section-text.md)

## Overview

Make the two template renderers, discuss-issue's `render_issue` and auto-fix-all's
`reply_comment`, insert every substituted value verbatim in a single pass, on both
the native (Node.js) and the shell path. Native switches to one regex with a replacer
function. Shell switches from `${content/…/$VAR}` (broken by bash ≥ 5.2's
`patsub_replacement`) to one perl pass reading values from env vars. The three
`replaceAll('{agent}', …)` calls are hardened with replacer functions. Specs, native
unit and shell-vs-native parity, cover `$`, `&`, `\` and stray-placeholder
input, and assert verbatim output.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

**Placeholder sets** (unchanged templates, each placeholder appears exactly once):

- `discuss-issue/templates/issue.tmpl.md`: `TITLE`, `DESCRIPTION`, `PROBLEM`,
  `EXPECTED_BEHAVIOR`, `SOLUTION`, `BENEFITS` (written `%%NAME%%`).
- `auto-fix-all/templates/reply.tmpl.md`: `BODY`, `AGENT`, `MODEL_NAME`,
  `MODEL_EMAIL`.

**Substitution semantics** (both paths, byte-identical):

1. One pass over the template text. Every `%%NAME%%` from the set is replaced by its
   value. Values are never re-scanned, so a value containing `%%OTHER%%` keeps it
   literally.
2. Values are inserted byte-for-byte. `$&`, `$``, `$'`, `$$`, `$<n>`,
   `&`, `\` and `\\` are not interpreted.
3. Everything else stays as today: render_issue's blank-line collapsing and
   leading/trailing trimming, the trailing `\n` on output, and reply_comment's
   posted body.

**Shared spec fixture**, used by both parity specs and the native unit specs: a
"hostile" value, literally (one line, no trailing newline):

```text
a $& b $` c $' d $$ e $1 f & g \ h \\ i %%SOLUTION%% j %%BODY%%
```

placed in every substituted value. Expected output is the template with that value
inserted verbatim. The shell-side specs exercise the `bash` on `PATH`; locally
that's Homebrew bash 5.3, which reproduces the bug before the fix.

## CI Checks

- `core`: `cd core && yarn test` (CI job: test), `cd core && yarn lint` (CI job: lint)

## Notes

- Ordering: scripter's shell changes and node's native changes are independent, but
  the parity specs (node, step 04) only pass once both are in.
- Before the fix, the current `render_issue.sh` can't render this issue's own text.
  The issue file was written directly.
