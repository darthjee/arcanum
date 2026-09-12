# Add SSH-proxy-style origin test coverage

`arcanum/_lib/test_origin_resolution.sh` already covers `https://`, `git@` (SCP-like), and `ssh://git@github.com/...` origins (Assertion 3, added for issue #237) — all of which resolve to domain `github.com`, where `get_repo_ref` and `get_repo_path` return the same value. There is no existing case where the domain differs from `github.com`, which is exactly the shape (`ssh.github.com`, an SSH proxy host) that exposed this issue's bug.

Add a new assertion block to `arcanum/_lib/test_origin_resolution.sh`, following the same throwaway-repo pattern already used for Assertion 3 (`git -C "$DIR" init -q && git -C "$DIR" remote add origin "..."`, cleaned up via the existing `trap cleanup EXIT` / `TMP_DIR` mechanism — add any new temp dirs to that same cleanup, or create your own trapped dir):

```sh
PROXY_DIR="$(mktemp -d)"
git -C "$PROXY_DIR" init -q
git -C "$PROXY_DIR" remote add origin "ssh://git@ssh.github.com:443/darthjee/arcanum.git"

proxy_domain=$(get_domain "$PROXY_DIR") || fail "get_domain failed for ssh-proxy origin"
proxy_ref=$(get_repo_ref "$PROXY_DIR") || fail "get_repo_ref failed for ssh-proxy origin"
proxy_path=$(get_repo_path "$PROXY_DIR") || fail "get_repo_path failed for ssh-proxy origin"

[[ "$proxy_domain" == "ssh.github.com" ]] || \
  fail "ssh-proxy origin resolved domain '$proxy_domain', expected 'ssh.github.com'"

[[ "$proxy_ref" == "ssh.github.com/darthjee/arcanum" ]] || \
  fail "get_repo_ref for ssh-proxy origin resolved '$proxy_ref', expected 'ssh.github.com/darthjee/arcanum' (domain-qualified)"

[[ "$proxy_path" == "darthjee/arcanum" ]] || \
  fail "get_repo_path for ssh-proxy origin resolved '$proxy_path', expected bare 'darthjee/arcanum'"

echo "OK: under an ssh-proxy-style origin (domain != github.com), get_repo_ref stays domain-qualified ('$proxy_ref') while get_repo_path stays bare ('$proxy_path')"
```

Place this after the existing Assertion 3 block, and clean up `$PROXY_DIR` the same way the existing `HTTPS_DIR`/`SCP_DIR`/`SSH_DIR` temp dirs are handled in that file (check whether they're already covered by the file's `cleanup()`/`trap`, or need their own `rm -rf` at the end of the block — match whatever the existing three temp dirs do).

## Files to Change

- `arcanum/_lib/test_origin_resolution.sh` — add the ssh-proxy-style origin assertion block above, verifying `get_repo_ref` and `get_repo_path` diverge as expected when the origin's domain isn't `github.com`.
