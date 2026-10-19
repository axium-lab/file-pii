#!/usr/bin/env bash
#
# Tag the version in package.json, push it, and publish to npm.
#
#   ./scripts/release.sh            # ask before the two irreversible steps
#   ./scripts/release.sh --yes      # no prompts (CI)
#   ./scripts/release.sh --dry-run  # print what it would do, touch nothing
#
# Order is deliberate: tag and push first, publish last. A tag is deletable; a
# published version is not — npm refuses to reuse `name@version` even after an
# unpublish, so the tag going out first means a failure at that stage costs
# nothing, while a failure after `npm publish` leaves the registry ahead of git
# rather than behind it.
#
# The registry is whatever `publishConfig` in package.json says (the scoped
# `@axium-lab:registry` key, then `registry`, then the public npm registry).
# The same registry is used for the "already published?" and login checks, so
# they agree with what `npm publish` will actually hit.
#
# Assumes you are already logged in (`npm whoami` is checked, not `npm login`).

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ASSUME_YES=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    --dry-run|-n) DRY_RUN=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

info() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[2m  would run: %s\033[0m\n' "$*"
  else
    "$@"
  fi
}

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  [ "$DRY_RUN" -eq 1 ] && return 0
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[yY]$ ]] || die 'aborted'
}

# ---------------------------------------------------------------- preflight --

command -v node >/dev/null || die 'node not found'
command -v npm  >/dev/null || die 'npm not found'
command -v git  >/dev/null || die 'git not found'

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
SCOPE="${NAME%%/*}"
REGISTRY=$(node -p "
  const p = require('./package.json').publishConfig ?? {};
  p['${SCOPE}:registry'] ?? p.registry ?? 'https://registry.npmjs.org'
")
ACCESS=$(node -p "require('./package.json').publishConfig?.access ?? 'public'")
TAG="v${VERSION}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

[ -n "$VERSION" ] || die 'no version in package.json'

info "${NAME}@${VERSION}  (tag ${TAG}, branch ${BRANCH})"
info "registry ${REGISTRY}  (access: ${ACCESS})"

# A dirty tree means the tag would not describe what gets published: `npm
# publish` packs the working directory, not the commit.
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  die 'working tree is dirty — commit or stash before releasing'
fi

# Re-tagging a published version is the one mistake this script cannot undo for
# you, so it refuses rather than moving the tag.
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  die "tag ${TAG} already exists locally — bump the version in package.json first"
fi
if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  die "tag ${TAG} already exists on origin"
fi

# Same check against the registry: catches a version published from another
# machine before the build spends two minutes on something npm will reject.
if npm view "${NAME}@${VERSION}" version --registry="${REGISTRY}" >/dev/null 2>&1; then
  die "${NAME}@${VERSION} is already published — npm never allows reusing a version"
fi

npm whoami --registry="${REGISTRY}" >/dev/null 2>&1 \
  || die "not logged in to ${REGISTRY} — run \`npm login --registry=${REGISTRY}\` first"

grep -qF "## [${VERSION}]" CHANGELOG.md \
  || warn "CHANGELOG.md has no '## [${VERSION}]' section"

if [ "$BRANCH" != 'main' ]; then
  warn "releasing from '${BRANCH}', not 'main'"
  confirm 'continue anyway?'
fi

# ------------------------------------------------------------ build & tests --

info 'typecheck'
run npm run typecheck

info 'tests'
run npm test

# `files` in package.json ships only `dist`, so a stale or missing dist is what
# gets published. Build from clean rather than trusting whatever is there.
info 'build (clean)'
run npm run clean
run npm run build

# --------------------------------------------------------------- tag & push --

confirm "tag ${TAG} and push it to origin/${BRANCH}?"

info "tagging ${TAG}"
run git tag -a "${TAG}" -m "${NAME}@${VERSION}"

info "pushing ${BRANCH} and ${TAG}"
run git push origin "${BRANCH}"
run git push origin "${TAG}"

# ------------------------------------------------------------------ publish --

confirm "publish ${NAME}@${VERSION} to ${REGISTRY} (${ACCESS}, irreversible)?"

info 'publishing'
# `access` and the registry come from publishConfig in package.json;
# --provenance is omitted because it only works from a CI runner with an OIDC token.
run npm publish

info "done — ${NAME}@${VERSION} published and tagged ${TAG}"
