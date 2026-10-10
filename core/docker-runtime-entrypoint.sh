#!/bin/sh
# Entrypoint for the core/ runtime image (the `runtime` target of
# core/Dockerfile, used by engine.mode=docker). See
# docs/agents/specs/docker/image.md#runtime-user-and-entrypoint.
#
# The container runs as the host user (`--user "$(id -u):$(id -g)"`),
# read-only, with /tmp a tmpfs. That uid has no /etc/passwd entry in the
# image, and OpenSSH (so git over SSH) aborts with "No user exists for
# uid" without one. This script gives it one through nss_wrapper — a
# one-line passwd and group file under $HOME, preloaded via LD_PRELOAD —
# without root, a writable /etc/passwd, chown or su. It then execs the
# arcanum CLI with the arguments dispatch passed.
#
# Idempotent: a second start in the same tmpfs rewrites the same files.
# LD_PRELOAD / NSS_WRAPPER_* are exported so they reach child processes;
# dispatch forwards them across nested `env -i` calls (see
# docs/agents/specs/docker/environment.md). The git credential helper and
# safe.directory come from dispatch env, not from here.
#
# core/docker-entrypoint.sh is the test image's entrypoint, not this one.
set -eu

ARCANUM_CLI=/opt/arcanum/core/bin/arcanum
NSS_WRAPPER_LIB=/usr/local/lib/libnss_wrapper.so

uid="$(id -u)"
gid="$(id -g)"

mkdir -p "$HOME"

printf 'arcanum:x:%s:%s:arcanum:%s:/bin/sh\n' "$uid" "$gid" "$HOME" > "$HOME/passwd"
printf 'arcanum:x:%s:\n' "$gid" > "$HOME/group"

case ":${LD_PRELOAD:-}:" in
    *":$NSS_WRAPPER_LIB:"*) ;;
    "::") LD_PRELOAD="$NSS_WRAPPER_LIB" ;;
    *) LD_PRELOAD="$NSS_WRAPPER_LIB:$LD_PRELOAD" ;;
esac

NSS_WRAPPER_PASSWD="$HOME/passwd"
NSS_WRAPPER_GROUP="$HOME/group"
export LD_PRELOAD NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP

exec "$ARCANUM_CLI" "$@"
