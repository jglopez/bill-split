#!/usr/bin/env bash
# Workers Builds' build command: bakes the release tag (production) or the
# pull request link (previews) into the footer.
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

# A preview links back to its pull request. Look it up through GitHub's
# public API; if that fails (rate limit, no PR yet, not on GitHub), the
# footer links to a search for the branch's PRs instead.
if [ -n "${WORKERS_CI_BRANCH:-}" ] && [ "$BRANCH" != "$PRODUCTION_BRANCH" ] && [ -z "${PREVIEW_PR_URL:-}" ]; then
  SLUG=$(git remote get-url origin 2>/dev/null | sed -nE 's#.*github\.com[/:]([^/]+/[^/]+)$#\1#p' | sed -E 's#(\.git)?/?$##')
  if [ -n "$SLUG" ]; then
    PR=$(curl -fsS --max-time 10 -G "https://api.github.com/repos/$SLUG/pulls" \
      --data-urlencode "head=${SLUG%%/*}:$BRANCH" --data-urlencode state=open 2>/dev/null \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s)[0]?.html_url??"")}catch{}})') || PR=""
    if [ -n "$PR" ]; then
      export PREVIEW_PR_URL="$PR"
      echo "Preview of $PR"
    fi
  fi
fi

exec npm run build
