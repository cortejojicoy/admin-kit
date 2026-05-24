#!/usr/bin/env bash
#
# Guarded release wrapper. Usage:
#   ./scripts/release.sh patch    # bug fix              0.1.0 -> 0.1.1
#   ./scripts/release.sh minor    # new feature (compat) 0.1.0 -> 0.2.0
#   ./scripts/release.sh major    # breaking change     0.1.0 -> 1.0.0
#
# What it does (in order):
#   1. Verify working tree is clean and we're on main.
#   2. Pull latest (fail if behind).
#   3. Run typecheck + build (also covered by preversion hook).
#   4. `npm version <bump>` — bumps package.json, runs version hook
#      (which promotes CHANGELOG Unreleased -> new version), creates
#      a git tag, then postversion hook pushes commit + tags.
#   5. `npm publish --access public` to npm.
#
set -euo pipefail

BUMP="${1:-}"
case "$BUMP" in
  patch|minor|major) ;;
  *)
    echo "usage: $0 <patch|minor|major>"
    exit 1
    ;;
esac

# 1. Clean tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is not clean. Commit or stash changes first."
  git status --short
  exit 1
fi

# 2. On main, up to date
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "error: releases must be cut from main (currently on '$BRANCH')."
  exit 1
fi

git fetch origin main --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "error: local main is not in sync with origin/main."
  echo "       run: git pull --ff-only origin main"
  exit 1
fi

# 3. Confirm npm auth
if ! npm whoami >/dev/null 2>&1; then
  echo "error: not logged into npm. Run 'npm login' first."
  exit 1
fi

CURRENT="$(node -p "require('./package.json').version")"
echo "current version: $CURRENT"
echo "bumping: $BUMP"
read -r -p "proceed? [y/N] " ans
[[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted."; exit 1; }

# 4. Bump version (runs preversion, version, postversion hooks)
npm version "$BUMP" -m "chore(release): v%s"

# 5. Publish
npm publish --access public

NEW="$(node -p "require('./package.json').version")"
echo
echo "released @kukux/admin-kit@$NEW"
echo "tag pushed: v$NEW"
