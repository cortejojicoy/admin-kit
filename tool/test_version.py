#!/usr/bin/env python3
"""Tests for tool/version.py.

The stage progression is a specification written as a table in that module's
docstring, and it is subtle in three places: `patch` from inside a stage,
which stage entry bumps a patch versus a minor, and the rc/lts ordering that
strict semver gets backwards. Those are exactly the rules a later edit breaks
silently, so they are asserted here.

    python3 -m unittest discover -s tool -p 'test_*.py'
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import version as v


def V(spec: str) -> v.Version:
    parsed = v.parse(spec)
    assert parsed is not None, spec
    return parsed


class Parsing(unittest.TestCase):
    def test_round_trips(self):
        for spec in ("v0.1.0", "v1.2.3", "v0.1.2-alpha.1", "v2.0.0-lts.11"):
            self.assertEqual(str(V(spec)), spec)

    def test_accepts_a_bare_version(self):
        # package.json holds "0.1.8" with no leading v.
        self.assertEqual(str(V("0.1.8")), "v0.1.8")

    def test_rejects_what_is_not_a_release_tag(self):
        for spec in ("", "v1", "v1.2", "1.2.3.4", "v1.2.3-dev.1", "v1.2.3-alpha.x", "latest"):
            self.assertIsNone(v.parse(spec), spec)

    def test_name_drops_the_v(self):
        self.assertEqual(V("v0.2.0-beta.3").name, "0.2.0-beta.3")


class Ordering(unittest.TestCase):
    def test_a_prerelease_sorts_before_its_bare_version(self):
        self.assertLess(V("v1.0.0-rc.1").sort_key(), V("v1.0.0").sort_key())

    def test_stages_rank_in_their_intended_order(self):
        # The deliberate departure from semver: lexically "lts" < "rc", which
        # would make an LTS candidate look older than the rc it follows.
        order = ["v1.0.0-alpha.1", "v1.0.0-beta.1", "v1.0.0-rc.1", "v1.0.0-lts.1", "v1.0.0"]
        keys = [V(spec).sort_key() for spec in order]
        self.assertEqual(keys, sorted(keys))

    def test_counters_order_numerically(self):
        self.assertLess(V("v1.0.0-beta.2").sort_key(), V("v1.0.0-beta.10").sort_key())


class DocumentedProgression(unittest.TestCase):
    """The table in the module docstring, asserted line by line."""

    def test_the_documented_walkthrough(self):
        steps = [
            ("v0.1.0", "patch", "v0.1.1"),
            ("v0.1.1", "alpha", "v0.1.2-alpha.1"),
            ("v0.1.2-alpha.1", "alpha", "v0.1.2-alpha.2"),
            ("v0.1.2-alpha.2", "promote", "v0.1.2"),
            ("v0.1.2", "patch", "v0.1.3"),
            ("v0.1.3", "beta", "v0.2.0-beta.1"),
            ("v0.2.0-beta.1", "promote", "v0.2.0"),
            ("v0.2.0", "patch", "v0.2.1"),
            ("v0.2.1", "rc", "v0.3.0-rc.1"),
            ("v0.3.0-rc.1", "promote", "v0.3.0"),
            ("v0.3.0", "patch", "v0.3.1"),
            ("v0.3.1", "lts", "v1.0.0-lts.1"),
            ("v1.0.0-lts.1", "promote", "v1.0.0"),
        ]
        for current, step, expected in steps:
            with self.subTest(current=current, step=step):
                self.assertEqual(str(v.next_version(V(current), step)), expected)

    def test_every_step_moves_strictly_forward(self):
        starts = ["v0.1.0", "v0.1.2-alpha.2", "v0.2.0-beta.1", "v1.0.0-rc.3", "v2.4.6"]
        for start in starts:
            current = V(start)
            for step in list(v.STAGES) + ["patch", "minor", "major"]:
                with self.subTest(start=start, step=step):
                    self.assertGreater(
                        v.next_version(current, step).sort_key(), current.sort_key()
                    )


class StepBehaviour(unittest.TestCase):
    def test_patch_inside_a_stage_stays_in_it_and_restarts_the_counter(self):
        # Keeps every tag unique and strictly increasing without leaving the
        # testing cycle.
        self.assertEqual(
            str(v.next_version(V("v0.1.2-alpha.4"), "patch")), "v0.1.3-alpha.1"
        )

    def test_alpha_from_a_bare_release_only_bumps_a_patch(self):
        self.assertEqual(str(v.next_version(V("v0.1.3"), "alpha")), "v0.1.4-alpha.1")

    def test_beta_and_rc_from_a_bare_release_open_a_minor(self):
        self.assertEqual(str(v.next_version(V("v0.1.3"), "beta")), "v0.2.0-beta.1")
        self.assertEqual(str(v.next_version(V("v0.1.3"), "rc")), "v0.2.0-rc.1")

    def test_lts_always_opens_a_major(self):
        self.assertEqual(str(v.next_version(V("v0.3.1"), "lts")), "v1.0.0-lts.1")
        self.assertEqual(str(v.next_version(V("v0.3.0-rc.2"), "lts")), "v1.0.0-lts.1")

    def test_moving_between_stages_opens_a_minor(self):
        self.assertEqual(
            str(v.next_version(V("v0.1.2-alpha.2"), "beta")), "v0.2.0-beta.1"
        )

    def test_minor_and_major_drop_the_stage(self):
        self.assertEqual(str(v.next_version(V("v0.1.2-alpha.2"), "minor")), "v0.2.0")
        self.assertEqual(str(v.next_version(V("v0.1.2-alpha.2"), "major")), "v1.0.0")

    def test_promote_refuses_a_bare_release(self):
        with self.assertRaises(SystemExit):
            v.next_version(V("v1.0.0"), "promote")

    def test_promote_refuses_when_there_is_nothing_tagged(self):
        with self.assertRaises(SystemExit):
            v.next_version(None, "promote")

    def test_seeding_from_nothing(self):
        self.assertEqual(str(v.next_version(None, "patch")), "v0.1.0")
        self.assertEqual(str(v.next_version(None, "beta")), "v0.1.0-beta.1")

    def test_unknown_step_is_refused(self):
        with self.assertRaises(SystemExit):
            v.next_version(V("v1.0.0"), "sideways")


class DistTags(unittest.TestCase):
    def test_only_a_bare_release_becomes_latest(self):
        # A pre-release published without --tag becomes `latest`, which is how
        # an alpha reaches everyone who typed `npm install`.
        self.assertEqual(V("v1.0.0").dist_tag, "latest")
        for stage in v.STAGES:
            self.assertEqual(V(f"v1.0.0-{stage}.1").dist_tag, stage)


class PackageJsonWrite(unittest.TestCase):
    SOURCE = (
        '{\n'
        '  "name": "@cortejojicoy/admin-kit",\n'
        '  "version": "0.1.8",\n'
        '  "description": "keep me",\n'
        '  "exports": { "./x": { "version": "not-this-one" } }\n'
        '}\n'
    )

    def write(self, spec: str) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "package.json"
            path.write_text(self.SOURCE, encoding="utf-8")
            v.write_package_json(V(spec), path)
            return path.read_text(encoding="utf-8")

    def test_writes_the_version_without_the_leading_v(self):
        self.assertIn('"version": "0.2.0"', self.write("v0.2.0"))

    def test_writes_a_prerelease_in_npm_form(self):
        self.assertIn('"version": "0.2.0-beta.1"', self.write("v0.2.0-beta.1"))

    def test_leaves_the_rest_of_the_file_byte_identical(self):
        # A JSON round-trip would reformat the whole file, so every release
        # would carry an unrelated diff.
        result = self.write("v0.2.0")
        self.assertIn('"description": "keep me"', result)
        self.assertEqual(result.count("\n"), self.SOURCE.count("\n"))
        self.assertTrue(result.endswith("}\n"))

    def test_only_touches_the_first_version_field(self):
        # There is a nested "version" inside exports in the real file.
        self.assertIn('"version": "not-this-one"', self.write("v0.2.0"))

    def test_it_stays_valid_json(self):
        json.loads(self.write("v0.2.0"))

    def test_a_file_without_a_version_field_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "package.json"
            path.write_text('{"name": "x"}\n', encoding="utf-8")
            with self.assertRaises(SystemExit):
                v.write_package_json(V("v1.0.0"), path)


class MonotonicGuard(unittest.TestCase):
    """The `tag` guard compares against the newest tag, not the baseline.

    tool/release.sh syncs package.json to the target *before* creating the tag,
    so a guard that consulted the baseline would compare the target against
    itself and refuse to create it. This was a live bug, found by rehearsing a
    release in a throwaway clone.
    """

    def test_the_target_may_equal_the_manifest_but_not_a_tag(self):
        target = V("v0.2.0")
        newest_tag = V("v0.1.7")
        synced_manifest = V("v0.2.0")

        self.assertGreater(target.sort_key(), newest_tag.sort_key())
        # The comparison that used to happen, and would have refused:
        self.assertFalse(target.sort_key() > synced_manifest.sort_key())


class Baseline(unittest.TestCase):
    def test_the_higher_of_tag_and_manifest_wins(self):
        # This repository shipped 0.1.8 to npm without pushing its tag, so the
        # newest tag is v0.1.7. Computing from the tag would propose v0.1.8
        # again and npm would refuse to republish it.
        self.assertEqual(
            max(V("v0.1.7"), V("v0.1.8"), key=v.Version.sort_key).name, "0.1.8"
        )
        self.assertEqual(
            max(V("v0.2.0"), V("v0.1.8"), key=v.Version.sort_key).name, "0.2.0"
        )


if __name__ == "__main__":
    unittest.main()
