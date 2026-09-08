/**
 * `admin-kit` — the CLI.
 *
 *   admin-kit init [--router app|pages] [--name "Acme"] [--force]
 *   admin-kit docs [--out docs/admin] [--config path] [--format md|mdx] [--check]
 */
import { runDocs } from './commands/docs'
import { runInit } from './commands/init'

const USAGE = `admin-kit — Next.js admin toolkit

Usage:
  admin-kit init [options]     Scaffold config, middleware, panels and routes
  admin-kit docs [options]     Generate markdown docs from your admin config

Init options:
  --router <app|pages>   Router flavour to scaffold for (default: app)
  --name <name>          App name written into the config (default: Admin)
  --force                Overwrite existing files

Docs options:
  --config <path>        Path to the admin config (default: auto-detect)
  --out <dir>            Output directory (default: docs/admin)
  --format <md|mdx>      Output extension (default: md)
  --check                Fail instead of writing when docs are out of date

Common:
  -h, --help             Show this message
  -v, --version          Print the package version
`

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const command = args._[0]

  if (args.help || command === 'help' || !command) {
    console.log(USAGE)
    return command ? 0 : 1
  }

  if (args.version) {
    console.log(await version())
    return 0
  }

  switch (command) {
    case 'init':
      return runInit({
        router: args.router === 'pages' ? 'pages' : 'app',
        name: typeof args.name === 'string' ? args.name : undefined,
        force: Boolean(args.force),
      })
    case 'docs':
      return runDocs({
        config: typeof args.config === 'string' ? args.config : undefined,
        out: typeof args.out === 'string' ? args.out : undefined,
        format: args.format === 'mdx' ? 'mdx' : 'md',
        check: Boolean(args.check),
      })
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(USAGE)
      return 1
  }
}

interface ParsedArgs {
  _: string[]
  [key: string]: string | boolean | string[] | undefined
}

/**
 * A minimal flag parser.
 *
 * Two commands and eight flags do not justify a dependency, and a CLI shipped
 * inside a library should add nothing to a consumer's install.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { _: [] }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '-h' || token === '--help') {
      args.help = true
    } else if (token === '-v' || token === '--version') {
      args.version = true
    } else if (token.startsWith('--')) {
      const [flag, inline] = splitFlag(token.slice(2))
      const next = argv[i + 1]
      if (inline !== undefined) {
        args[flag] = inline
      } else if (next && !next.startsWith('-')) {
        args[flag] = next
        i++
      } else {
        args[flag] = true
      }
    } else {
      args._.push(token)
    }
  }
  return args
}

function splitFlag(raw: string): [string, string | undefined] {
  const index = raw.indexOf('=')
  return index === -1 ? [raw, undefined] : [raw.slice(0, index), raw.slice(index + 1)]
}

async function version(): Promise<string> {
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '../package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
