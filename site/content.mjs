/**
 * What the site is made of.
 *
 * The docs pages are the single source of truth for their own prose; this file
 * only says which ones exist, in what order, and what the landing page claims.
 * Adding a page means adding `docs/<slug>.md` and one entry here.
 */

export const SITE = {
  name: 'admin-kit',
  pkg: '@cortejojicoy/admin-kit',
  tagline: 'A Next.js admin toolkit you configure rather than fork.',
  description:
    'Declare your endpoints, your permissions and your modules once; get a launcher panel, a sidebar panel, generated CRUD screens, and documentation of your own installation.',
  repo: 'https://github.com/cortejojicoy/admin-kit',
  npm: 'https://www.npmjs.com/package/@cortejojicoy/admin-kit',
  license: 'MIT',

  /*
   * The live demo — `examples/app-router`, deployed.
   *
   * Left null until it is actually deployed, and every "Try the demo" button is
   * gated on it: a button pointing at a URL that 404s is worse than no button.
   * Set it to the deployed URL (or export SITE_DEMO_URL) and the buttons appear
   * on the next build. See docs/demo.md for the deploy.
   */
  demo: process.env.SITE_DEMO_URL ?? null,
}

/** Credentials the demo seeds, surfaced next to the button. */
export const DEMO = {
  password: 'demo',
  accounts: [
    { email: 'ada@axiomkit.test', role: 'admin', note: 'sees everything, including the admin panel' },
    { email: 'blaise@axiomkit.test', role: 'manager', note: 'may edit users but not delete them' },
    { email: 'chen@axiomkit.test', role: 'staff', note: 'read-only' },
  ],
}

/** Sidebar groups. `slug` maps to `docs/<slug>.md`. */
export const NAV = [
  {
    title: 'Start here',
    items: [
      {
        slug: 'getting-started',
        title: 'Getting started',
        summary: 'Install, scaffold, mount the provider and land on a working panel.',
      },
      {
        slug: 'demo',
        title: 'Live demo',
        summary: 'Three accounts, three different applications — what each one sees and why.',
      },
      {
        slug: 'configuration',
        title: 'Configuration',
        summary: 'Every key of AdminConfig, why it is plain data, and what the defaults are.',
      },
    ],
  },
  {
    title: 'Guides',
    items: [
      {
        slug: 'authentication',
        title: 'Authentication',
        summary: 'JWT, OAuth and custom providers; where the token lives and who can read it.',
      },
      {
        slug: 'access-control',
        title: 'Access control',
        summary: 'Catalog, entitlement and permission — three axes, and only one real gate.',
      },
      {
        slug: 'navigation',
        title: 'Navigation & panels',
        summary: 'The launcher, the sidebar panel, and how each entry is filtered.',
      },
      {
        slug: 'resources',
        title: 'Resources & CRUD',
        summary: 'Declare endpoints and fields; get tables, forms and hooks.',
      },
      {
        slug: 'theming',
        title: 'Theming',
        summary: 'One stylesheet, driven entirely by CSS custom properties.',
      },
    ],
  },
  {
    title: 'Tooling',
    items: [
      {
        slug: 'cli',
        title: 'CLI',
        summary: '`admin-kit init` and `admin-kit docs`, including the CI check.',
      },
      {
        slug: 'releases',
        title: 'Versioning & releases',
        summary: 'Git tags are the source of truth; package.json is derived.',
      },
    ],
  },
  {
    title: 'Reference',
    items: [
      {
        slug: 'api-reference',
        title: 'API reference',
        summary: 'Every export, by sub-path, with the environment it belongs to.',
      },
    ],
  },
]

/**
 * Standalone pages: rendered without the docs sidebar and linked from the
 * footer rather than the documentation nav. Legal text is something people go
 * looking for, not something they browse through on the way to an API.
 */
export const LEGAL_PAGES = [
  {
    slug: 'privacy-policy',
    path: 'privacy',
    title: 'Privacy Policy',
    summary: 'What this site collects under the Data Privacy Act of 2012 (RA 10173), and your rights.',
  },
]

/** Flat page list in sidebar order — drives prev/next and the build loop. */
export const PAGES = NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))

/* ------------------------------- landing -------------------------------- */

export const FEATURES = [
  {
    icon: 'plug',
    title: 'Every endpoint is yours',
    body: 'Login was pluggable in 0.1.x; now list, read, create, update, delete and any named action are too — declared per resource, with the wire format mapped in both directions.',
  },
  {
    icon: 'shield',
    title: 'Three-axis access control',
    body: 'Catalog (does the module exist?), entitlement (may this tenant run it?), permission (may this user open it?) — separately configured, with none / view / full levels rather than a boolean.',
  },
  {
    icon: 'panels',
    title: 'Two panels, split by work',
    body: 'A launcher for daily work that everyone lands on, and a sidebar panel for administration. Split by kind of work, not kind of account.',
  },
  {
    icon: 'data',
    title: 'Serializable config',
    body: 'Plain data, so navigation resolves on the server with the user’s permissions already in hand — and a CLI can read the same config in plain Node.',
  },
  {
    icon: 'brush',
    title: 'Styled on install',
    body: 'One stylesheet driven by CSS custom properties. No Tailwind, no preset, no content globs — and every component takes a className.',
  },
  {
    icon: 'book',
    title: 'Docs of your install',
    body: '`admin-kit docs` writes markdown describing your endpoints, your roles and your screens. `--check` in CI stops it from drifting.',
  },
]

/**
 * The landing page's config sample. Raw source, highlighted at build time —
 * so it stays editable as code rather than as a wall of hand-written spans,
 * and it picks up every improvement to the tokenizer for free.
 */
export const CONFIG_SAMPLE = `export const adminConfig = defineAdminConfig({
  app: { name: 'Axiomkit', logoIconKey: 'grid' },

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: { login: '/api/auth/login', me: '/api/auth/me' },
      tokenStorage: 'server-cookie',   // the browser never holds it
    },
  },

  access: {
    roles: { admin: ['*'], manager: ['users:*'] },
    deny:  { manager: ['users:delete'] },
  },

  resources: [{
    name: 'users',
    endpoints: {
      list:   '/api/users',
      remove: { method: 'DELETE', path: '/api/users/:id' },
    },
    permissions: { list: 'users:list', remove: 'users:delete' },
  }],
})`

/**
 * The server-only half of the config. Shown as the editor's second tab: the
 * secret living in a different file is the whole reason there are two.
 */
export const SERVER_SAMPLE = `import { defineAdminServerConfig } from '@cortejojicoy/admin-kit'

// Never imported from a client component. Keeping the secret out of
// admin.config.ts is what stops it reaching the browser bundle.
export const serverConfig = defineAdminServerConfig({
  jwt: {
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    cookieName: 'axiomkit_session',
  },
  apiBaseUrl: process.env.API_BASE_URL,
})`

/** The hero's shell session. */
export const INSTALL_SESSION = {
  title: 'axiomkit — zsh — 80×24',
  lines: [
    { comment: 'install, scaffold, and document your own config' },
    { cmd: 'pnpm add @cortejojicoy/admin-kit' },
    { cmd: 'npx admin-kit init' },
    { cmd: 'npx admin-kit docs' },
  ],
}

export const AXES = [
  ['Catalog', 'Does the module exist and is it active?', 'Fall back to the declared modules, so navigation never blanks'],
  ['Entitlement', 'May this tenant run it?', 'Fail <strong>open</strong> by default'],
  ['Permission', 'May this user open it?', 'Fail <strong>open</strong> by default'],
]

export const EXPORTS = [
  ['@cortejojicoy/admin-kit', 'Config helpers, types, pure logic', 'Anywhere, including plain Node'],
  ['…/client', '<code>AdminProvider</code>, contexts, hooks', 'Client'],
  ['…/data', 'CRUD hooks, data provider, resource types', 'Client'],
  ['…/access', 'Engine, <code>&lt;Can&gt;</code>, guards', 'Client'],
  ['…/ui', 'Panels, primitives, generated screens', 'Client'],
  ['…/server', 'Session, access gates, cookies', 'Server'],
  ['…/middleware', '<code>createAdminMiddleware</code>', 'Edge'],
  ['…/styles.css', 'The stylesheet', '—'],
]
