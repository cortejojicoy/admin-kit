/**
 * Copy the stylesheet into dist.
 *
 * tsup bundles JS; the CSS is authored by hand and shipped as-is, so it needs
 * one copy step. Kept as a script rather than a tsup `publicDir` so the build
 * fails loudly if the file is ever moved or renamed.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src/ui/styles.css')
const target = join(root, 'dist/styles.css')

if (!existsSync(source)) {
  console.error(`copy-styles: missing ${source}`)
  process.exit(1)
}

mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log('copy-styles: dist/styles.css')
