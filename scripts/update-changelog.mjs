#!/usr/bin/env node
/**
 * Runs from the `version` lifecycle hook (after `npm version <bump>` has
 * already updated package.json). Promotes the `## [Unreleased]` block to
 * `## [<new version>] - <YYYY-MM-DD>` and seeds an empty Unreleased block.
 *
 * Safe to run twice (idempotent for the same version — does nothing if a
 * section for that version already exists).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const version = pkg.version
const today = new Date().toISOString().slice(0, 10)
const changelogPath = resolve(root, 'CHANGELOG.md')

let changelog = readFileSync(changelogPath, 'utf8')

if (changelog.includes(`## [${version}]`)) {
  console.log(`[update-changelog] ## [${version}] already present — skipping.`)
  process.exit(0)
}

const UNRELEASED_HEADER = '## [Unreleased]'
const idx = changelog.indexOf(UNRELEASED_HEADER)
if (idx === -1) {
  console.error('[update-changelog] could not find "## [Unreleased]" section.')
  process.exit(1)
}

const before = changelog.slice(0, idx + UNRELEASED_HEADER.length)
const after = changelog.slice(idx + UNRELEASED_HEADER.length)

const seededUnreleased = `\n\n### Added\n-\n\n### Changed\n-\n\n### Fixed\n-\n\n## [${version}] - ${today}`

changelog = before + seededUnreleased + after

writeFileSync(changelogPath, changelog)
console.log(`[update-changelog] promoted Unreleased → [${version}] (${today}).`)
