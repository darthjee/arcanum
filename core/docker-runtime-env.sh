# shellcheck shell=sh
# Runtime user setup for the core/ runtime image, sourced (not executed)
# by core/docker-runtime-entrypoint.sh — and by `make core-smoke-runtime`,
# which checks the same setup without exec'ing the arcanum CLI. See
# docs/agents/specs/docker/image.md#runtime-user-and-entrypoint.
#
# The container runs as the host user (`--user "$(id -u):$(id -g)"`),
# read-only, with /tmp a tmpfs. That uid has no /etc/passwd entry in the
# image, and OpenSSH (so git over SSH) aborts with "No user exists for
# uid" without one. This gives it one through nss_wrapper — a one-line
# passwd and group file under $HOME, preloaded via LD_PRELOAD — without
# root, a writable /etc/passwd, chown or su.
#
# Idempotent: a second start in the same tmpfs rewrites the same files.
# LD_PRELOAD / NSS_WRAPPER_* are exported so they reach child processes;
# dispatch forwards them across nested `env -i` calls (see
# docs/agents/specs/docker/environment.md). The git credential helper and
# safe.directory come from dispatch env, not from here.

ARCANUM_NSS_WRAPPER_LIB=/usr/local/lib/libnss_wrapper.so

mkdir -p "$HOME"

printf 'arcanum:x:%s:%s:arcanum:%s:/bin/sh\n' "$(id -u)" "$(id -g)" "$HOME" > "$HOME/passwd"
printf 'arcanum:x:%s:\n' "$(id -g)" > "$HOME/group"

case ":${LD_PRELOAD:-}:" in
    *":$ARCANUM_NSS_WRAPPER_LIB:"*) ;;
    "::") LD_PRELOAD="$ARCANUM_NSS_WRAPPER_LIB" ;;
    *) LD_PRELOAD="$ARCANUM_NSS_WRAPPER_LIB:$LD_PRELOAD" ;;
esac

NSS_WRAPPER_PASSWD="$HOME/passwd"
NSS_WRAPPER_GROUP="$HOME/group"
export LD_PRELOAD NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP
