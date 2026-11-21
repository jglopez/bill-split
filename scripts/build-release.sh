#!/usr/bin/env bash
# Production build with the release tag baked in for the footer.
#
# Auto-release tags the merged commit in parallel with the deploy build,
# so on the production branch the tag may not exist yet: wait briefly for it.
# The tag is display-only, so give up rather than block the deploy.
# Any other branch has no release tag coming, and builds right away.
set -euo pipefail

PRODUCTION_BRANCH="${PRODUCTION_BRANCH:-main}"
# Workers Builds sets WORKERS_CI_*; elsewhere fall back to git.
BRANCH="${WORKERS_CI_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"
SHA="${WORKERS_CI_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}"

if [ -z "${APP_VERSION:-}" ] && [ "$BRANCH" = "$PRODUCTION_BRANCH" ] && [ -n "$SHA" ]; then
  for _ in $(seq 1 18); do
    # Query the remote directly; CI checkouts are often shallow and carry no tags.
    # Annotated tags appear twice; the "^{}" line carries the commit SHA.
    TAG=$(git ls-remote --tags origin 'refs/tags/v*' 2>/dev/null \
      | awk -v sha="$SHA" '$1 == sha { sub("refs/tags/", "", $2); sub(/\^\{\}$/, "", $2); print $2 }' \
      | sort -V | tail -1) || TAG=""
    if [ -n "$TAG" ]; then
      export APP_VERSION="$TAG"
      echo "Release version: $TAG"
      break
    fi
    sleep 10
  done
  [ -n "${APP_VERSION:-}" ] || echo "No release tag on $SHA yet; building as unreleased."
fi

exec npm run build
