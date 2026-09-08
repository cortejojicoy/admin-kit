import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { createJiti as CreateJiti } from 'jiti'
import type { AdminConfig } from '../config/types'

const CANDIDATES = [
  'admin.config.ts',
  'admin.config.mts',
  'admin.config.js',
  'admin.config.mjs',
  'src/admin.config.ts',
  'app/admin.config.ts',
  'config/admin.config.ts',
]

export interface LoadedConfig {
  config: AdminConfig
  path: string
}

/**
 * Load the consumer's `admin.config.ts` in plain Node.
 *
 * This is the reason the core entry point stays free of React and DOM code: a
 * config that transitively imports a client component cannot be read by a CLI,
 * and then no tool can ever generate documentation, scaffolding or checks from
 * it. Everything the config touches is plain data by design.
 *
 * TypeScript is transpiled through `jiti`, an optional peer dependency — only
 * CLI users pay for it, and the failure mode is a clear instruction rather than
 * a module-resolution stack trace.
 */
export async function loadAdminConfig(explicitPath?: string, cwd = process.cwd()): Promise<LoadedConfig> {
  const path = explicitPath ? resolve(cwd, explicitPath) : findConfig(cwd)
  if (!path) {
    throw new Error(
      `Could not find an admin config. Looked for:\n` +
        CANDIDATES.map((c) => `  ${c}`).join('\n') +
        `\nPass one explicitly with --config <path>.`,
    )
  }
  if (!existsSync(path)) throw new Error(`Config not found: ${path}`)

  const loaded = await importModule(path)
  const config = pickConfig(loaded)
  if (!config) {
    throw new Error(
      `${path} does not export an admin config. Export it as \`adminConfig\` ` +
        `or as the default export.`,
    )
  }
  return { config, path }
}

function findConfig(cwd: string): string | null {
  for (const candidate of CANDIDATES) {
    const path = resolve(cwd, candidate)
    if (existsSync(path)) return path
  }
  return null
}

async function importModule(path: string): Promise<Record<string, unknown>> {
  if (/\.(mjs|js|cjs)$/.test(path)) {
    // Cache-busted: Node's ESM loader keys modules by URL and never
    // re-evaluates, so calling this twice in one process (a watch loop, a test,
    // a programmatic caller) would keep reading the config as it was on first
    // import. Harmless for a one-shot CLI, wrong for everything else.
    return (await import(`${pathToUrl(path)}?t=${Date.now()}`)) as Record<string, unknown>
  }

  let createJiti: typeof CreateJiti
  try {
    ;({ createJiti } = await import('jiti'))
  } catch {
    throw new Error(
      'Reading a TypeScript config needs `jiti`. Install it as a dev dependency:\n' +
        '  pnpm add -D jiti\n' +
        'Or point --config at a compiled .js/.mjs file.',
    )
  }

  const jiti = createJiti(process.cwd(), { interopDefault: false })
  return (await jiti.import(path))
}

function pathToUrl(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`
}

function pickConfig(loaded: Record<string, unknown>): AdminConfig | null {
  const candidates = [loaded.adminConfig, loaded.default, loaded.config]
  for (const candidate of candidates) {
    if (isConfig(candidate)) return candidate
    // A default export that is itself a module namespace (jiti interop).
    if (candidate && typeof candidate === 'object') {
      const inner = (candidate as Record<string, unknown>).adminConfig
      if (isConfig(inner)) return inner
    }
  }
  return null
}

function isConfig(value: unknown): value is AdminConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'app' in value &&
    'auth' in value &&
    typeof (value as AdminConfig).app?.name === 'string'
  )
}
