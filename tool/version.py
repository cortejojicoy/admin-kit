#!/usr/bin/env python3
"""Release versioning driven by git tags.

Adapted from trackbnb-flutter's `tool/version.py`. The scheme and the stage
progression are unchanged; what differs is the derived artifact — `package.json`
rather than `pubspec.yaml` — and two npm-specific additions noted below.

Tags are the source of truth. `package.json`'s `version` is a derived artifact:
this script writes the tag's version into it.

    vMAJOR.MINOR.PATCH[-stage.N]        alpha | beta | rc | lts

Stage progression, and how each step is spelled:

    v0.1.0                  seed                          next patch
    v0.1.1                  bug fix in development        next patch
    v0.1.2-alpha.1          enter internal testing        next alpha
    v0.1.2-alpha.2          another internal build        next alpha
    v0.1.2                  stable at alpha, released     next promote
    v0.1.3                  minor bug fix                 next patch
    v0.2.0-beta.1           enter public testing          next beta
    v0.2.1                  stable at beta                next promote
    v0.3.0-rc.1             final validation              next rc
    v0.3.1                  final release                 next promote
    v1.0.0-lts.1            production candidate          next lts
    v1.0.0                  official release              next promote

Ordering follows semver (a pre-release sorts before its bare version) with one
deliberate exception: stages rank alpha < beta < rc < lts, whereas strict semver
would compare the identifiers lexically and put "lts" before "rc".

Two things are npm-specific rather than inherited:

  * There is no `versionCode`, so the original's `code` subcommand is gone. npm
    has one version string and no integer build number.
  * A pre-release must not become `latest` on the registry, or `npm install`
    hands an alpha to everyone. `dist-tag` prints the channel a version belongs
    on, and the publish workflow passes it to `npm publish --tag`.

Subcommands:
    current                     newest tag, or nothing when untagged
    stage                       stage of the newest tag
    list                        every release tag, oldest first
    next <step>                 compute the next tag without creating it
    tag <step> [-m MSG]         compute it and create an annotated git tag
    tag --tag T [-m MSG]        create a specific tag, with the same guards
    sync [--tag T]              write the version into package.json
    dist-tag [--tag T]          the npm dist-tag the version publishes under
    notes [--tag T]             release notes for a version
    changelog [--tag T]         promote CHANGELOG's Unreleased section
    check [--tag T]             assert tag, package.json and HEAD agree

Steps: alpha, beta, rc, lts, promote, patch, minor, major
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import NamedTuple, Optional

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = ROOT / "package.json"
CHANGELOG = ROOT / "CHANGELOG.md"

# Their intended progression. Strict semver would order these lexically, which
# gets rc/lts backwards, so rank them explicitly.
STAGES = ("alpha", "beta", "rc", "lts")
STAGE_RANK = {name: index for index, name in enumerate(STAGES)}

# A bare release outranks any pre-release of the same X.Y.Z, per semver.
BARE_RANK = len(STAGES)

TAG_RE = re.compile(
    r"^v?(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)"
    r"(?:-(?P<stage>alpha|beta|rc|lts)(?:\.(?P<counter>\d+))?)?$"
)


class Version(NamedTuple):
    major: int
    minor: int
    patch: int
    stage: Optional[str]
    counter: Optional[int]

    def __str__(self) -> str:
        core = f"v{self.major}.{self.minor}.{self.patch}"
        if self.stage is None:
            return core
        if self.counter is None:
            return f"{core}-{self.stage}"
        return f"{core}-{self.stage}.{self.counter}"

    @property
    def name(self) -> str:
        """The npm version, i.e. the tag without its leading `v`."""
        return str(self)[1:]

    @property
    def is_prerelease(self) -> bool:
        return self.stage is not None

    @property
    def dist_tag(self) -> str:
        """The npm channel this version belongs on.

        A pre-release published without `--tag` becomes `latest`, which is how
        an alpha ends up installed by everyone who typed `npm install`. Each
        stage gets its own channel instead, so opting in is explicit:
        `npm install @cortejojicoy/admin-kit@beta`.
        """
        return "latest" if self.stage is None else self.stage

    def sort_key(self) -> tuple:
        if self.stage is None:
            return (self.major, self.minor, self.patch, BARE_RANK, 0)
        return (
            self.major,
            self.minor,
            self.patch,
            STAGE_RANK[self.stage],
            self.counter if self.counter is not None else 0,
        )


def parse(tag: str) -> Optional[Version]:
    match = TAG_RE.match(tag.strip())
    if match is None:
        return None
    counter = match.group("counter")
    return Version(
        major=int(match.group("major")),
        minor=int(match.group("minor")),
        patch=int(match.group("patch")),
        stage=match.group("stage"),
        counter=int(counter) if counter is not None else None,
    )


def git(*args: str) -> str:
    result = subprocess.run(
        ("git",) + args, capture_output=True, text=True, check=False, cwd=ROOT
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def all_versions() -> list[Version]:
    raw = git("tag", "--list", "v*")
    if not raw:
        return []
    parsed = [parse(line) for line in raw.splitlines()]
    return sorted((v for v in parsed if v is not None), key=Version.sort_key)


def current_version() -> Optional[Version]:
    versions = all_versions()
    return versions[-1] if versions else None


def manifest_version() -> Optional[Version]:
    """The version currently written in package.json."""
    try:
        data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    raw = data.get("version")
    return parse(raw) if isinstance(raw, str) else None


def baseline() -> Optional[Version]:
    """What `next` computes from: the highest of the newest tag and package.json.

    Tags are the source of truth, but they can *lag* it — this repository's
    v0.1.8 was published to npm without its tag ever being pushed, so the
    newest tag says v0.1.7 while the registry says 0.1.8. Computing from the
    tag alone would propose v0.1.8 again, and npm refuses to republish a
    version that already exists.

    Taking the higher of the two means the numbering can never regress against
    something already shipped. It plays the same role as the legacy build-number
    floor in the Flutter original.
    """
    tag = current_version()
    manifest = manifest_version()
    if tag is None:
        return manifest
    if manifest is None:
        return tag
    return max(tag, manifest, key=Version.sort_key)


def next_version(current: Optional[Version], step: str) -> Version:
    # Untagged: seed the scheme. A stage step seeds straight into that stage.
    if current is None:
        if step in STAGES:
            return Version(0, 1, 0, step, 1)
        if step == "promote":
            raise SystemExit("Nothing to promote: there are no tags yet.")
        return Version(0, 1, 0, None, None)

    if step == "promote":
        if not current.is_prerelease:
            raise SystemExit(
                f"{current} is already a bare release. Use `next patch` for a "
                "bug-fix release, or a stage step to open the next cycle."
            )
        return Version(current.major, current.minor, current.patch, None, None)

    if step == "patch":
        # From a pre-release, stay in the stage but start its counter over on
        # the new patch — that keeps every tag unique and strictly increasing.
        if current.is_prerelease:
            return Version(
                current.major, current.minor, current.patch + 1, current.stage, 1
            )
        return Version(current.major, current.minor, current.patch + 1, None, None)

    if step == "minor":
        return Version(current.major, current.minor + 1, 0, None, None)

    if step == "major":
        return Version(current.major + 1, 0, 0, None, None)

    if step in STAGES:
        # Same stage: another build in the current cycle.
        if current.stage == step:
            return Version(
                current.major,
                current.minor,
                current.patch,
                step,
                (current.counter or 1) + 1,
            )

        # Entering a stage from a bare release, or moving between stages.
        # lts opens a major; the others open a minor. Both match the spec's
        # examples: v0.1.8 -> v0.2.0-beta.1, v0.2.4 -> v0.3.0-rc.1,
        # v0.3.1 -> v1.0.0-lts.1.
        if step == "lts":
            return Version(current.major + 1, 0, 0, step, 1)

        if current.is_prerelease:
            return Version(current.major, current.minor + 1, 0, step, 1)

        # A bare release entering its first stage only needs a patch, which is
        # how v0.1.3 becomes v0.1.4-alpha.1.
        if step == STAGES[0]:
            return Version(current.major, current.minor, current.patch + 1, step, 1)

        return Version(current.major, current.minor + 1, 0, step, 1)

    raise SystemExit(f"Unknown step '{step}'.")


def write_package_json(version: Version, path: Path = PACKAGE_JSON) -> str:
    """Write the version into package.json.

    A targeted substitution on the `"version"` line rather than a JSON
    round-trip: re-serializing would reformat the whole file, so every release
    would carry an unrelated diff and `npm pkg`'s key ordering would fight the
    repository's.
    """
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(r'^(?P<indent>\s*)"version":\s*"[^"]*"', re.M)
    if pattern.search(source) is None:
        raise SystemExit(f"{path} has no top-level \"version\" field.")

    replacement = rf'\g<indent>"version": "{version.name}"'
    path.write_text(pattern.sub(replacement, source, count=1), encoding="utf-8")
    return f'"version": "{version.name}"'


def previous_version(version: Version) -> Optional[Version]:
    """The newest release that sorts before `version`."""
    earlier = [v for v in all_versions() if v.sort_key() < version.sort_key()]
    return earlier[-1] if earlier else None


def changelog_section(version: Version) -> Optional[str]:
    """The CHANGELOG body already written for this version, if any."""
    if not CHANGELOG.exists():
        return None
    source = CHANGELOG.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"^## \[{re.escape(version.name)}\].*?$(?P<body>.*?)(?=^## |\Z)",
        re.M | re.S,
    )
    match = pattern.search(source)
    return match.group("body").strip() if match else None


def unreleased_section() -> Optional[str]:
    if not CHANGELOG.exists():
        return None
    pattern = re.compile(r"^## \[Unreleased\].*?$(?P<body>.*?)(?=^## |\Z)", re.M | re.S)
    match = pattern.search(CHANGELOG.read_text(encoding="utf-8"))
    return match.group("body").strip() if match else None


def release_notes(version: Version) -> str:
    """Notes for a release: the CHANGELOG entry, else the commit log.

    The CHANGELOG is preferred because it says what changed for a *consumer*;
    the commit log is the fallback for a release nobody wrote notes for.
    """
    written = changelog_section(version) or unreleased_section()
    if written:
        return written

    previous = previous_version(version)
    if previous is None:
        return f"First tagged release ({version})."

    log = git("log", "--no-merges", "--pretty=- %s", f"{previous}..HEAD")
    body = log or f"- No commits recorded since {previous}."
    return f"Changes since {previous}:\n\n{body}"


def promote_changelog(version: Version) -> str:
    """Turn `## [Unreleased]` into `## [x.y.z] - YYYY-MM-DD` and reseed it.

    Idempotent: a section for the version already present is left alone, so
    re-running a half-finished release does not duplicate it.
    """
    if not CHANGELOG.exists():
        raise SystemExit(f"{CHANGELOG} does not exist.")

    source = CHANGELOG.read_text(encoding="utf-8")
    if f"## [{version.name}]" in source:
        return f"CHANGELOG already has [{version.name}] — left as is."

    header = "## [Unreleased]"
    if header not in source:
        raise SystemExit(f'{CHANGELOG} has no "{header}" section.')

    seed = (
        f"{header}\n\n### Added\n-\n\n### Changed\n-\n\n### Fixed\n-\n\n"
        f"## [{version.name}] - {date.today().isoformat()}"
    )
    CHANGELOG.write_text(source.replace(header, seed, 1), encoding="utf-8")
    return f"CHANGELOG: promoted Unreleased -> [{version.name}]"


def check(version: Version) -> list[str]:
    """Everything that would make this release describe the wrong thing."""
    problems: list[str] = []

    manifest = manifest_version()
    if manifest is None:
        problems.append("package.json has no readable version.")
    elif manifest.sort_key() != version.sort_key():
        problems.append(
            f"package.json says {manifest.name}, but the release is {version.name}. "
            "Run: tool/version.py sync"
        )

    if git("status", "--porcelain"):
        problems.append(
            "The working tree has uncommitted changes, so the tag will not "
            "describe what gets published."
        )

    head_tags = git("tag", "--points-at", "HEAD").splitlines()
    if str(version) not in head_tags:
        problems.append(
            f"{version} does not point at HEAD, so the published build is not "
            "the commit the tag names."
        )

    return problems


def require_clean_tree() -> None:
    if git("status", "--porcelain"):
        print(
            "Warning: the working tree has uncommitted changes, so this tag will\n"
            "         not describe what you build.",
            file=sys.stderr,
        )


def resolve_target(explicit: Optional[str]) -> Version:
    """The version a command should act on: `--tag`, else the newest tag."""
    if explicit:
        version = parse(explicit)
        if version is None:
            raise SystemExit(f"'{explicit}' is not a vX.Y.Z[-stage.N] tag.")
        return version

    current = current_version()
    if current is None:
        raise SystemExit(
            "No release tags yet. Create one first: tool/version.py tag patch"
        )
    return current


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("current", help="newest tag")
    sub.add_parser("stage", help="stage of the newest tag")
    sub.add_parser("list", help="every release tag, oldest first")

    steps = list(STAGES) + ["promote", "patch", "minor", "major"]

    next_parser = sub.add_parser("next")
    next_parser.add_argument("step", choices=steps)

    # `tag` takes a step *or* an explicit version. The explicit form exists for
    # tool/release.sh: it computes the target before syncing package.json, and
    # re-deriving afterwards would compute from the version it just wrote and
    # skip ahead by one.
    tag_parser = sub.add_parser("tag")
    tag_parser.add_argument("step", nargs="?", choices=steps, default=None)
    tag_parser.add_argument("--tag", default=None)
    tag_parser.add_argument("-m", "--message", default=None)

    for name in ("sync", "dist-tag", "notes", "changelog", "check"):
        p = sub.add_parser(name)
        p.add_argument("--tag", default=None)

    args = parser.parse_args()

    if args.command == "current":
        current = current_version()
        if current is None:
            raise SystemExit(
                "No release tags yet. Start with: tool/version.py tag patch"
            )
        print(current)
        # Surface the drift rather than letting it decide a version silently.
        manifest = manifest_version()
        if manifest is not None and manifest.sort_key() > current.sort_key():
            print(
                f"note: package.json is ahead at {manifest.name} — `next` computes "
                f"from that, so nothing already published is reused.",
                file=sys.stderr,
            )
        return

    if args.command == "stage":
        current = current_version()
        print("none" if current is None else (current.stage or "stable"))
        return

    if args.command == "list":
        for version in all_versions():
            print(version)
        return

    if args.command == "next":
        print(next_version(baseline(), args.step))
        return

    if args.command == "tag":
        if (args.step is None) == (args.tag is None):
            raise SystemExit("Pass exactly one of a step or --tag <version>.")
        target = parse(args.tag) if args.tag else next_version(baseline(), args.step)
        if target is None:
            raise SystemExit(f"'{args.tag}' is not a vX.Y.Z[-stage.N] tag.")

        existing = {str(v) for v in all_versions()}
        if str(target) in existing:
            raise SystemExit(f"Tag {target} already exists.")

        # Compared against the newest *tag*, not the baseline.
        #
        # The baseline includes package.json, and by the time release.sh calls
        # this the manifest has already been synced to the target — so guarding
        # against the baseline would refuse to create the very tag it was asked
        # for. "Does not sort after the last release" means the last tag.
        latest = current_version()
        if latest is not None and target.sort_key() <= latest.sort_key():
            raise SystemExit(
                f"Refusing to create {target}: it does not sort after {latest}."
            )

        require_clean_tree()
        message = args.message or f"Release {target}"
        result = subprocess.run(
            ("git", "tag", "-a", str(target), "-m", message),
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if result.returncode != 0:
            raise SystemExit(result.stderr.strip() or f"Could not create tag {target}.")
        print(target)
        return

    if args.command == "sync":
        print(write_package_json(resolve_target(args.tag)))
        return

    if args.command == "dist-tag":
        print(resolve_target(args.tag).dist_tag)
        return

    if args.command == "notes":
        print(release_notes(resolve_target(args.tag)))
        return

    if args.command == "changelog":
        print(promote_changelog(resolve_target(args.tag)))
        return

    if args.command == "check":
        target = resolve_target(args.tag)
        problems = check(target)
        if problems:
            print(f"{target} is not ready to publish:", file=sys.stderr)
            for problem in problems:
                print(f"  - {problem}", file=sys.stderr)
            raise SystemExit(1)
        print(f"{target} checks out: package.json matches, tree is clean, tag is HEAD.")
        return


if __name__ == "__main__":
    main()
