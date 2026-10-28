#!/bin/sh
# Container preflight — run this BEFORE pushing, and before telling anyone the
# container works.
#
#   sh verify.sh
#
# Copy this file into the app repo. It is the platform standard check: it does not
# read your Dockerfile, it builds it and then interrogates the running container.
# "The Dockerfile looks right" is not a result; this is.
#
# Needs a container runtime (Podman / Rancher Desktop / Docker Engine in WSL2) and
# curl. On Windows run it from Git Bash or WSL.
#
# ── Configure with environment variables ──────────────────────────────────
#   PORT          port the container listens on            (default 8501)
#   HEALTH_PATH   path that must return 200                (default /_stcore/health)
#   PAGE_PATH     extra page that must return 200          (optional)
#   SPA_ROUTE     deep client-side route that must not 404 (optional, SPAs only)
#   MAX_MB        image size budget, unpacked              (default 900)
#   CONTEXT       docker build context                     (default .)
#   DOCKERFILE    path to the Dockerfile                   (default Dockerfile)
#   RUN_ENV       extra "-e K=V" args passed to docker run (optional)
#
# Per-stack values are in references/stack-recipes.md. Two containers (SPA + API)?
# Run this twice with different settings — the /api routing between them is done by
# the Ingress and has no local equivalent, so it cannot be checked here either way.
#
# Examples:
#   sh verify.sh                                            # Streamlit defaults
#   PORT=8000 HEALTH_PATH=/healthz sh verify.sh              # FastAPI
#   PORT=8080 HEALTH_PATH=/ SPA_ROUTE=/reports/2024 MAX_MB=200 sh verify.sh
set -eu

DOCKER=${DOCKER:-docker}
IMAGE=${IMAGE:-verify-local-$$}
PORT=${PORT:-8501}
HEALTH_PATH=${HEALTH_PATH:-/_stcore/health}
PAGE_PATH=${PAGE_PATH:-}
SPA_ROUTE=${SPA_ROUTE:-}
MAX_MB=${MAX_MB:-900}
CONTEXT=${CONTEXT:-.}
DOCKERFILE=${DOCKERFILE:-Dockerfile}
RUN_ENV=${RUN_ENV:-}
HOST_PORT=${HOST_PORT:-18${PORT#?}}
TIMEOUT=${TIMEOUT:-60}

CONTAINER=verify-$$
FAILED=0

cleanup() {
  $DOCKER rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

ok()   { printf '    OK    %s\n' "$1"; }
bad()  { printf '    FAIL  %s\n' "$1"; FAILED=1; }

logs_of() {
  echo "    ---- container logs (last 100 lines) ----"
  $DOCKER logs --tail=100 "$CONTAINER" 2>&1 | sed 's/^/      | /' || echo "      (never started)"
}

echo "==> 0/6 Container runtime reachable"
# Checked separately and first, because "the daemon is not running" and "your
# Dockerfile is wrong" call for completely different actions, and a build failure
# reports both the same way.
if ! $DOCKER info >/dev/null 2>&1; then
  echo "    NOT REACHABLE — the container runtime is not running."
  echo ""
  echo "    Nothing here is wrong with your code. Start Docker Desktop / Podman /"
  echo "    Rancher Desktop and run this again. If you have no runtime installed at"
  echo "    all, that is fine: skip verify.sh and let CI be the first real check —"
  echo "    just say so rather than implying the container works."
  exit 2
fi
ok "runtime reachable"

echo "==> 1/6 Build"
$DOCKER build -f "$DOCKERFILE" -t "$IMAGE" "$CONTEXT" \
  || { echo "FAILED: the build itself failed — see the error above. The runtime is"; \
       echo "fine, so this is the Dockerfile or a dependency."; exit 1; }
ok "image built"

echo "==> 2/6 Start"
# Published on 127.0.0.1 only, so a test container is never exposed to the office
# network while you are trying things out.
# shellcheck disable=SC2086
$DOCKER run -d --name "$CONTAINER" -p "127.0.0.1:${HOST_PORT}:${PORT}" $RUN_ENV "$IMAGE" >/dev/null
ok "container started"

echo "==> 3/6 Health ${HEALTH_PATH} from OUTSIDE the container (max ${TIMEOUT}s)"
# Curling from the host is also the proof that the app binds 0.0.0.0: if it bound
# 127.0.0.1 inside the container the published port would connect to nothing. In
# the cluster that same mistake shows up as a probe that never succeeds, with no
# error at all in the application log.
elapsed=0
until curl -fsS "http://127.0.0.1:${HOST_PORT}${HEALTH_PATH}" >/dev/null 2>&1; do
  if [ "$($DOCKER inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    bad "the container died before it began serving"; logs_of
    echo "    HINT: if the log says a script was 'not found' but the file is clearly"
    echo "    there, that is CRLF line endings — the kernel is looking for an"
    echo "    interpreter whose name ends in a carriage return. Fix: add"
    echo "    '*.sh text eol=lf' to .gitattributes, then run:"
    echo "      git add --renormalize . && git commit"
    exit 1
  fi
  elapsed=$((elapsed + 2))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    bad "no 200 within ${TIMEOUT}s"; logs_of; exit 1
  fi
  sleep 2
done
ok "200 in ~${elapsed}s (binding to 0.0.0.0 proven)"
if [ "$elapsed" -gt 30 ]; then
  echo "    WARNING: startup over 30s — raise the probe initialDelaySeconds, or move"
  echo "    heavy work out of import time."
fi

echo "==> 4/6 Extra page"
if [ -n "$PAGE_PATH" ]; then
  # Deliberately separate from health: a health endpoint usually touches no
  # templates, so a missing views/ or static folder leaves health green while every
  # real page returns 500.
  if curl -fsS "http://127.0.0.1:${HOST_PORT}${PAGE_PATH}" >/dev/null 2>&1; then
    ok "${PAGE_PATH} returned 200"
  else
    bad "${PAGE_PATH} did not return 200 although health is OK — usually a template or static folder missing from the image"
  fi
else
  echo "    skipped (PAGE_PATH not set)"
fi

echo "==> 5/6 SPA deep route"
if [ -n "$SPA_ROUTE" ]; then
  # The failure that most often reaches production: navigating from INSIDE the app
  # never touches it, so it only shows up when a user presses refresh or opens a
  # bookmarked link.
  if curl -fsS "http://127.0.0.1:${HOST_PORT}${SPA_ROUTE}" >/dev/null 2>&1; then
    ok "${SPA_ROUTE} served (no 404)"
  else
    bad "${SPA_ROUTE} 404ed — SPA fallback missing (try_files ... /index.html)"
  fi
else
  echo "    skipped (SPA_ROUTE not set)"
fi

echo "==> 6/6 Non-root and image size"
UID_IN=$($DOCKER exec "$CONTAINER" id -u 2>/dev/null || echo "?")
if [ "$UID_IN" = "0" ] || [ "$UID_IN" = "?" ]; then
  bad "runs as root (uid $UID_IN) — add a USER line"
else
  ok "non-root, uid $UID_IN"
fi

# Do NOT use `docker image inspect -f .Size` here. It is not comparable across
# machines: with the containerd image store (default in recent Docker Desktop) it
# reports COMPRESSED layer size, with classic overlay2 the UNPACKED size. Measured
# on one real image: inspect said 176MB while `image ls` said 767MB — a 4x gap that
# makes any budget check meaningless.
SIZE_HUMAN=$($DOCKER image ls "$IMAGE" --format '{{.Size}}' | head -1)
SIZE_MB=$(printf '%s' "$SIZE_HUMAN" | awk '
  /GB/ { gsub(/[^0-9.]/, ""); printf "%d", $0 * 1000; exit }
  /MB/ { gsub(/[^0-9.]/, ""); printf "%d", $0; exit }
  { printf "0"; exit }')
echo "    ${SIZE_HUMAN} unpacked (budget ${MAX_MB}MB)"
if [ "$SIZE_MB" -gt "$MAX_MB" ]; then
  echo "    WARNING: over budget. First suspect is always the dependency file — an"
  echo "    unused heavy dependency. Second is a data file slipping past"
  echo "    .dockerignore. This is a warning, not a failure."
fi

echo ""
if [ "$FAILED" != "0" ]; then
  echo "SOME CHECKS FAILED — do not push until this is clean."
  exit 1
fi

echo "ALL CHECKS PASSED."
echo ""
echo "What this does NOT prove:"
echo "  - that queries against the real data source are correct (no credentials here)"
echo "  - that the numbers are right"
echo "  - for a two-container app: the /api routing, which the Ingress does and which"
echo "    has no local equivalent"
echo "  - that the ECR repo, Secret, Ingress and DNS exist — ask the infra team"
echo ""
echo "To look at it: $DOCKER run --rm -p 127.0.0.1:${HOST_PORT}:${PORT} $RUN_ENV $IMAGE"
echo "then open http://127.0.0.1:${HOST_PORT}"
