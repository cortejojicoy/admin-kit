import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from '../src/cli/index'
import { runInit } from '../src/cli/commands/init'
import { runDocs } from '../src/cli/commands/docs'
import { generateDocs } from '../src/cli/generators/index'
import type { AdminConfig } from '../src/config/types'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'admin-kit-test-'))
}

describe('parseArgs', () => {
  it('reads commands, flags and values', () => {
    const args = parseArgs(['docs', '--out', 'docs/x', '--check'])
    expect(args._).toEqual(['docs'])
    expect(args.out).toBe('docs/x')
    expect(args.check).toBe(true)
  })

  it('accepts --flag=value', () => {
    expect(parseArgs(['docs', '--format=mdx']).format).toBe('mdx')
  })

  it('treats a trailing flag as boolean', () => {
    expect(parseArgs(['docs', '--check', '--out']).out).toBe(true)
  })

  it('recognizes the short forms', () => {
    expect(parseArgs(['-h']).help).toBe(true)
    expect(parseArgs(['-v']).version).toBe(true)
  })
})

describe('runInit', () => {
  it('scaffolds the app-router layout, config and login route', () => {
    const cwd = tempDir()
    expect(runInit({ cwd, name: 'Acme' })).toBe(0)

    const files = readdirSync(cwd)
    expect(files).toContain('admin.config.ts')
    expect(files).toContain('admin.server.ts')
    expect(files).toContain('middleware.ts')

    const config = readFileSync(join(cwd, 'admin.config.ts'), 'utf8')
    expect(config).toContain("name: 'Acme'")
    expect(config).toContain("tokenStorage: 'server-cookie'")

    // The secret must be in the server-only file and nowhere else.
    expect(config).not.toContain('JWT_SECRET')
    expect(readFileSync(join(cwd, 'admin.server.ts'), 'utf8')).toContain('process.env.JWT_SECRET')
  })

  it('refuses to overwrite without --force', () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, 'admin.config.ts'), 'ORIGINAL', 'utf8')

    runInit({ cwd })
    expect(readFileSync(join(cwd, 'admin.config.ts'), 'utf8')).toBe('ORIGINAL')

    runInit({ cwd, force: true })
    expect(readFileSync(join(cwd, 'admin.config.ts'), 'utf8')).not.toBe('ORIGINAL')
  })

  it('scaffolds the pages router when asked', () => {
    const cwd = tempDir()
    runInit({ cwd, router: 'pages' })
    expect(readFileSync(join(cwd, 'pages/_app.tsx'), 'utf8')).toContain('AdminProvider')
    expect(readFileSync(join(cwd, 'admin.config.ts'), 'utf8')).toContain("router: 'pages'")
  })
})

describe('generateDocs', () => {
  const config: AdminConfig = {
    app: { name: 'Acme', flavor: 'clinic' },
    auth: {
      provider: 'jwt',
      jwt: {
        endpoints: { login: '/api/auth/login', me: '/api/auth/me' },
        cookieName: 'session',
        secret: 'MUST-NOT-APPEAR',
        tokenStorage: 'server-cookie',
      },
    },
    access: {
      roles: { admin: ['*'], editor: ['users:*'], viewer: ['*:list'] },
      hierarchy: { admin: ['editor'] },
      deny: { editor: ['users:delete'] },
      permissions: { endpoint: '/api/me/permissions', onUnavailable: 'allow' },
      entitlements: { endpoint: '/api/me/tenant' },
    },
    modules: [
      {
        code: 'USERS',
        title: 'Users',
        href: '/users',
        description: { default: 'Accounts.', clinic: 'Clinic accounts.' },
      },
      { code: 'LABS', title: 'Labs', href: '/labs', placement: 'dock' },
    ],
    resources: [
      {
        name: 'users',
        endpoints: {
          list: '/api/users',
          create: { method: 'POST', path: '/api/users' },
          remove: { method: 'DELETE', path: '/api/users/:id' },
        },
        fields: [{ name: 'email', type: 'email', required: true }],
        permissions: { list: 'users:list', create: 'users:create', remove: 'users:delete' },
      },
    ],
    navigation: {
      sections: [{ id: 'main', label: 'Main', items: [{ label: 'Home', href: '/' }] }],
    },
  }

  const files = generateDocs(config)
  const byName = new Map(files.map((f) => [f.name, f.content]))

  it('writes a page per topic', () => {
    expect([...byName.keys()]).toEqual([
      'README.md',
      'getting-started.md',
      'auth.md',
      'access.md',
      'navigation.md',
      'resources.md',
      'configuration.md',
    ])
  })

  it('documents the consumer’s own endpoints, not a template', () => {
    const auth = byName.get('auth.md')!
    expect(auth).toContain('/api/auth/login')
    expect(auth).toContain('session')
    expect(auth).toContain('HttpOnly')
  })

  it('never prints a secret', () => {
    // These files get committed, so a leaked secret would be a leaked secret in
    // git history.
    for (const [name, content] of byName) {
      expect(content, name).not.toContain('MUST-NOT-APPEAR')
    }
  })

  it('builds a role matrix that expands hierarchy and honours deny', () => {
    const access = byName.get('access.md')!
    expect(access).toContain('| Permission |')
    // editor inherits nothing here, but admin inherits editor — and admin's own
    // '*' grant covers everything anyway.
    expect(access).toMatch(/`users:delete`.*✗ denied/)
    expect(access).toContain('Role inheritance')
  })

  it('lists every declared endpoint with its verb and permission', () => {
    const resources = byName.get('resources.md')!
    expect(resources).toContain('`DELETE`')
    expect(resources).toContain('`/api/users/:id`')
    expect(resources).toContain('`users:create`')
  })

  it('separates tiles from the dock and resolves flavoured copy', () => {
    const navigation = byName.get('navigation.md')!
    expect(navigation).toContain('Quick-access dock')
    expect(navigation).toContain('Clinic accounts.')
    expect(navigation).not.toContain('Accounts.')
  })

  it('marks the output as generated so nobody hand-edits it', () => {
    for (const content of byName.values()) {
      expect(content.startsWith('<!-- Generated by `admin-kit docs`')).toBe(true)
    }
  })
})

describe('runDocs', () => {
  const configSource = `
    export const adminConfig = {
      app: { name: 'FromDisk' },
      auth: { provider: 'jwt', jwt: { endpoints: { login: '/l', me: '/m' } } },
    }
  `

  it('writes docs from a config on disk', async () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, 'admin.config.mjs'), configSource, 'utf8')

    const code = await runDocs({ cwd, config: 'admin.config.mjs', out: 'docs/admin' })
    expect(code).toBe(0)
    expect(readFileSync(join(cwd, 'docs/admin/README.md'), 'utf8')).toContain('FromDisk')
  })

  it('--check fails when the docs are missing or stale', async () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, 'admin.config.mjs'), configSource, 'utf8')

    expect(await runDocs({ cwd, config: 'admin.config.mjs', check: true })).toBe(1)
    await runDocs({ cwd, config: 'admin.config.mjs' })
    expect(await runDocs({ cwd, config: 'admin.config.mjs', check: true })).toBe(0)

    // A different config against the same output must fail the check. Written
    // to a second file rather than by editing the first: vitest's module runner
    // caches by resolved id and ignores the cache-busting query that makes
    // re-reading work under plain Node, so editing in place would test the
    // runner's cache rather than the check.
    writeFileSync(
      join(cwd, 'renamed.config.mjs'),
      configSource.replace('FromDisk', 'Renamed'),
      'utf8',
    )
    expect(await runDocs({ cwd, config: 'renamed.config.mjs', check: true })).toBe(1)
  })

  it('honours --format mdx', async () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, 'admin.config.mjs'), configSource, 'utf8')
    await runDocs({ cwd, config: 'admin.config.mjs', format: 'mdx' })
    expect(readdirSync(join(cwd, 'docs/admin')).every((f) => f.endsWith('.mdx'))).toBe(true)
  })

  it('explains itself when there is no config to find', async () => {
    await expect(runDocs({ cwd: tempDir() })).rejects.toThrow(/Could not find an admin config/)
  })

  it('explains itself when the file exports nothing usable', async () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, 'admin.config.mjs'), 'export const nope = 1', 'utf8')
    await expect(runDocs({ cwd, config: 'admin.config.mjs' })).rejects.toThrow(
      /does not export an admin config/,
    )
  })
})
