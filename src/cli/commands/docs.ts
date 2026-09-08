import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { generateDocs } from '../generators/index'
import { loadAdminConfig } from '../loadConfig'

export interface DocsOptions {
  config?: string
  out?: string
  /** Compare instead of writing — exits non-zero when the output would change. */
  check?: boolean
  format?: 'md' | 'mdx'
  cwd?: string
}

/**
 * Generate the docs, or verify they are current.
 *
 * `--check` is the reason this is worth having in CI: documentation that
 * describes endpoints and permission matrices goes stale the first time someone
 * adds a resource, and a diff that fails the build is the only thing that
 * reliably prevents it.
 */
export async function runDocs(options: DocsOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const { config, path } = await loadAdminConfig(options.config, cwd)

  const outDir = join(cwd, options.out ?? 'docs/admin')
  const extension = options.format === 'mdx' ? '.mdx' : '.md'

  const files = generateDocs(config, {
    packageName: '@cortejojicoy/admin-kit',
    configPath: relative(cwd, path) || 'admin.config.ts',
  }).map((file) => ({
    ...file,
    name: file.name.replace(/\.md$/, extension),
  }))

  if (options.check) {
    const stale: string[] = []
    for (const file of files) {
      const target = join(outDir, file.name)
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null
      if (current !== file.content) stale.push(file.name)
    }
    if (stale.length > 0) {
      console.error(`Documentation is out of date (${stale.length} file(s)):`)
      for (const name of stale) console.error(`  ${name}`)
      console.error('\nRun `admin-kit docs` and commit the result.')
      return 1
    }
    console.log(`Documentation is up to date (${files.length} files).`)
    return 0
  }

  mkdirSync(outDir, { recursive: true })
  for (const file of files) {
    writeFileSync(join(outDir, file.name), file.content, 'utf8')
    console.log(`  ${relative(cwd, join(outDir, file.name))}`)
  }
  console.log(`\nWrote ${files.length} files from ${relative(cwd, path)}.`)
  return 0
}
