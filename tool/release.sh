#!/usr/bin/env bash
#
# Cut a release. Git tags are the source of truth; this script makes the
# repository agree with the tag it is about to create, then pushes both.
#
#   ./tool/release.sh minor              0.1.8 -> v0.2.0
#   ./tool/release.sh beta               open a public-testing cycle
#   ./tool/release.sh promote            turn the current pre-release stable
#   ./tool/release.sh patch --dry-run    show everything, change nothing
#
# Steps: alpha, beta, rc, lts, promote, patch, minor, major
# See tool/version.py for the stage progression, or:
#   ./tool/version.py current            what is released now
#   ./tool/version.py next beta          what `release.sh beta` would create
#
# What it does, in order:
#   1. Refuse to run from a dirty tree, a branch other than main, or a main
#      that is behind origin.
#   2. Compute the target version (once — see the note below).
#   3. Run `pnpm verify`: typecheck, lint, tests, build, import smoke test,
#      publint, are-the-types-wrong.
#   4. Promote CHANGELOG's Unreleased section to the target version.
#   5. Write the version into package.json.
#   6. Commit, then tag that commit, so the tag names a commit that already
#      contains the version it claims.
#   7. Push the commit and the tag. CI publishes from the tag.
#
set -euo pipefail

cd "$(dirname "$0")/.."

version_py="tool/version.py"
step=""
dry_run=0
push=1
skip_verify=0
message=""

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    alpha|beta|rc|lts|promote|patch|minor|major)
      [[ -n "$step" ]] && { echo "error: more than one step given" >&2; exit 1; }
      step="$1"
      ;;
    --dry-run)     dry_run=1 ;;
    --no-push)     push=0 ;;
    --skip-verify) skip_verify=1 ;;
    -m|--message)  message="${2:-}"; shift ;;
    -h|--help)     usage 0 ;;
    *) echo "error: unknown argument '$1'" >&2; usage ;;
  esac
  shift
done

[[ -z "$step" ]] && { echo "error: no step given" >&2; usage; }

# -----------------------------------------------------------------------------
# Guards
# -----------------------------------------------------------------------------

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "error: releases are cut from main (currently on '$branch')." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: the working tree is not clean. Commit or stash first." >&2
  git status --short >&2
  exit 1
fi

git fetch origin main --quiet
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "error: local main and origin/main have diverged." >&2
  echo "       run: git pull --ff-only origin main" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Target
# -----------------------------------------------------------------------------

# Computed once, up front, and passed to `version.py tag --tag` later. Deriving
# it again after step 5 would compute from the package.json this script just
# wrote and skip a version.
target="$("$version_py" next "$step")"
current="$("$version_py" current 2>/dev/null || echo '(none)')"
dist_tag="$("$version_py" dist-tag --tag "$target")"

echo "current:  $current"
echo "releasing: $target"
echo "npm tag:  $dist_tag"
if [[ "$dist_tag" != "latest" ]]; then
  echo "          (a pre-release — 'npm install' keeps serving latest)"
fi
echo

if [[ "$dry_run" == "1" ]]; then
  echo "--- dry run: nothing below is executed ---"
  echo "  pnpm verify"
  echo "  $version_py changelog --tag $target"
  echo "  $version_py sync --tag $target"
  echo "  git commit -m 'chore(release): $target'"
  echo "  $version_py tag --tag $target"
  [[ "$push" == "1" ]] && echo "  git push origin main --follow-tags"
  echo
  echo "release notes would be:"
  "$version_py" notes --tag "$target" | sed 's/^/  | /'
  exit 0
fi

read -r -p "proceed? [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "aborted."; exit 1; }

# -----------------------------------------------------------------------------
# Verify, then make the repository agree with the tag
# -----------------------------------------------------------------------------

# From here on the repository is being changed. If any step fails, say how to
# get back — a half-finished release is precisely when that is hard to work out
# from memory.
started_at="$(git rev-parse HEAD)"
trap 'status=$?; if [[ $status -ne 0 ]]; then
  echo >&2
  echo "release failed partway through. To unwind:" >&2
  echo "  git tag -d $target 2>/dev/null || true" >&2
  echo "  git reset --hard $started_at" >&2
fi' EXIT

if [[ "$skip_verify" == "1" ]]; then
  echo "warning: skipping verify — publishing something untested." >&2
else
  echo "==> pnpm verify"
  pnpm verify
fi

echo "==> $("$version_py" changelog --tag "$target")"
echo "==> package.json: $("$version_py" sync --tag "$target")"

git add package.json CHANGELOG.md
git commit -m "chore(release): $target" --quiet
echo "==> committed chore(release): $target"

notes="${message:-$("$version_py" notes --tag "$target")}"
"$version_py" tag --tag "$target" -m "$notes" >/dev/null
echo "==> tagged $target"

# `check` is what CI runs before publishing. Running it here means a mismatch
# surfaces now rather than after the tag is public.
"$version_py" check --tag "$target"

if [[ "$push" == "1" ]]; then
  echo "==> pushing main and $target"
  git push origin main --follow-tags
  cat <<TXT

Pushed. CI takes it from here:
  verify -> npm publish --tag $dist_tag --provenance -> GitHub release

  https://github.com/cortejojicoy/admin-kit/actions
TXT
else
  cat <<TXT

Not pushed (--no-push). When you are ready:
  git push origin main --follow-tags

To undo locally:
  git tag -d $target && git reset --hard HEAD~1
TXT
fi
