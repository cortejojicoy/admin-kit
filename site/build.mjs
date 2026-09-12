/**
 * Builds the documentation site into `site/dist`.
 *
 *   node site/build.mjs              # build once
 *   node site/build.mjs --serve      # build, serve on :4321, rebuild on request
 *   SITE_BASE=/admin-kit/ node site/build.mjs
 *
 * `SITE_BASE` is what makes a GitHub project page work: the site lives under
 * `/<repo>/`, so every internal link is written with that prefix. It defaults
 * to `/` for local previewing, where the site is the whole origin.
 *
 * The markdown in `docs/` is the source of truth and stays readable on GitHub —
 * page links are written as `./other-page.md` and rewritten here.
 */
import { createServer } from 'node:http'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderMarkdown } from './lib/markdown.mjs'
import { editor, escHtml, icon, shell, sidebar, terminal, toc } from './lib/layout.mjs'
import {
  AXES,
  CONFIG_SAMPLE,
  DEMO,
  EXPORTS,
  FEATURES,
  INSTALL_SESSION,
  LEGAL_PAGES,
  NAV,
  PAGES,
  SERVER_SAMPLE,
  SITE,
} from './content.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const docsDir = join(root, 'docs')
const outDir = join(here, 'dist')

const BASE = normalizeBase(process.env.SITE_BASE ?? '/')
const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

function normalizeBase(value) {
  const withLead = value.startsWith('/') ? value : `/${value}`
  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

/* ------------------------------ link rewriting --------------------------- */

const SLUGS = new Set(PAGES.map((p) => p.slug))
/** Legal pages live at their own path, not under /docs/. */
const LEGAL_BY_SLUG = new Map(LEGAL_PAGES.map((p) => [p.slug, p]))

/**
 * Turns the links that work on GitHub into the links that work on the site.
 * A `.md` target that is a known page becomes a clean URL; anything else that
 * points into the repository becomes a link to the repository.
 */
function rewriteLink(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href

  const [path, hash = ''] = href.split('#')
  const suffix = hash ? `#${hash}` : ''

  // `./page.md` — a sibling in docs/ — is always meant as a docs page, so an
  // unknown one is a typo. Left alone it would become a repository URL that
  // 404s quietly, which is worse than failing the build here.
  const md = path.match(/^\.\/([\w-]+)\.mdx?$/)
  if (md) {
    if (SLUGS.has(md[1])) return `${BASE}docs/${md[1]}/${suffix}`
    if (LEGAL_BY_SLUG.has(md[1])) return `${BASE}${LEGAL_BY_SLUG.get(md[1]).path}/${suffix}`
    throw new Error(
      `site: link to unknown docs page "${path}"\n` +
        `  known pages: ${[...SLUGS].join(', ')}\n` +
        `  for a repository file, write the path from the repo root (e.g. ../README.md)`,
    )
  }

  if (path === './' || path === '.') return `${BASE}docs/${suffix}`

  // A root-relative path is a link within this site; `checkLinks` verifies it.
  if (path.startsWith('/')) return href

  // Anything else is a repository path: README.md, examples/, src/, LICENSE.
  const clean = path.replace(/^\.\//, '').replace(/^\.\.\//, '')
  return `${SITE.repo}/blob/main/${clean}${suffix}`
}

/* --------------------------------- pages --------------------------------- */

function docPage(page, index) {
  const file = join(docsDir, `${page.slug}.md`)
  if (!existsSync(file)) throw new Error(`missing docs page: docs/${page.slug}.md`)

  const { html, headings, title } = renderMarkdown(readFileSync(file, 'utf8'), { rewriteLink })
  const prev = PAGES[index - 1]
  const next = PAGES[index + 1]

  const pager = `<nav class="pager" aria-label="Pagination">
    ${
      prev
        ? `<a class="prev" href="${BASE}docs/${prev.slug}/"><span>Previous</span><strong>${escHtml(prev.title)}</strong></a>`
        : '<span></span>'
    }
    ${
      next
        ? `<a class="next" href="${BASE}docs/${next.slug}/"><span>Next</span><strong>${escHtml(next.title)}</strong></a>`
        : '<span></span>'
    }
  </nav>`

  const body = `<div class="docs-layout">
  ${sidebar(BASE, page.slug)}
  <main class="doc" id="content">
    <div class="breadcrumb"><a href="${BASE}docs/">Docs</a><span>/</span><span>${escHtml(page.group)}</span></div>
    <article class="prose">${html}</article>
    ${pager}
    <p class="edit"><a href="${SITE.repo}/blob/main/docs/${page.slug}.md" target="_blank" rel="noreferrer noopener">Edit this page on GitHub</a></p>
  </main>
  ${toc(headings)}
</div>`

  return {
    path: `docs/${page.slug}/index.html`,
    html: shell({
      base: BASE,
      title: title ?? page.title,
      description: page.summary.replace(/`/g, ''),
      bodyClass: 'has-sidebar',
      active: page.slug,
      body,
    }),
    headings,
  }
}

function docsIndexPage() {
  const groups = NAV.map(
    (group) => `<section class="index-group">
    <h2>${escHtml(group.title)}</h2>
    <div class="card-grid">
      ${group.items
        .map(
          (item) => `<a class="card" href="${BASE}docs/${item.slug}/">
        <h3>${escHtml(item.title)}${icon('arrow', 'card-arrow')}</h3>
        <p>${inlineCode(item.summary)}</p>
      </a>`,
        )
        .join('')}
    </div>
  </section>`,
  ).join('')

  const body = `<div class="docs-layout">
  ${sidebar(BASE, null)}
  <main class="doc" id="content">
    <article class="prose index-intro">
      <h1>Documentation</h1>
      <p>
        <code>${SITE.pkg}</code> is a Next.js admin toolkit you configure rather than fork.
        Start with <a href="${BASE}docs/getting-started/">Getting started</a> for a working
        installation in five steps, then read <a href="${BASE}docs/access-control/">Access control</a> —
        it is the part most likely to be assumed rather than read.
      </p>
    </article>
    ${groups}
  </main>
  <div class="toc"></div>
</div>`

  return {
    path: 'docs/index.html',
    html: shell({
      base: BASE,
      title: 'Documentation',
      description: `Documentation for ${SITE.pkg} — configuration, authentication, access control, resources and the CLI.`,
      bodyClass: 'has-sidebar',
      active: null,
      body,
    }),
  }
}

/** `summary` strings carry backticks; render those as code, escape the rest. */
function inlineCode(text) {
  return escHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}


/**
 * The "try the demo" button, rendered only when a demo URL is configured.
 *
 * `examples/app-router` needs a Node server — route handlers, cookie auth,
 * server components — so it cannot live on this static site and has to be
 * deployed somewhere. Until it is, no button: one pointing at a 404 is worse
 * than none at all. Set `SITE.demo` (or `SITE_DEMO_URL`) to turn it on.
 */
function demoButton() {
  if (!SITE.demo) return ''
  return `<a class="btn demo" href="${SITE.demo}" target="_blank" rel="noreferrer noopener">${icon(
    'play',
  )} Try the demo</a>`
}

/** The seeded logins, so a visitor can sign in without hunting for them. */
function demoHint() {
  if (!SITE.demo) return ''
  const accounts = DEMO.accounts
    .map((a) => `<li><code>${escHtml(a.email)}</code> <span>${escHtml(a.note)}</span></li>`)
    .join('')
  return `<div class="demo-hint">
    <p>Sign in to the demo with any of these and the password <code>${escHtml(DEMO.password)}</code>:</p>
    <ul>${accounts}</ul>
  </div>`
}


/**
 * A standalone page — legal text, mostly. Same prose styling as the docs, but
 * no sidebar and no prev/next: nobody arrives at a privacy policy midway
 * through a reading order.
 */
function legalPage(page) {
  const file = join(docsDir, `${page.slug}.md`)
  if (!existsSync(file)) throw new Error(`missing page: docs/${page.slug}.md`)

  const { html, headings, title } = renderMarkdown(readFileSync(file, 'utf8'), { rewriteLink })

  const body = `<div class="legal-layout">
  <main class="doc" id="content">
    <article class="prose">${html}</article>
    <p class="edit"><a href="${SITE.repo}/blob/main/docs/${page.slug}.md" target="_blank" rel="noreferrer noopener">View this page's history on GitHub</a></p>
  </main>
  ${toc(headings)}
</div>`

  return {
    path: `${page.path}/index.html`,
    html: shell({
      base: BASE,
      title: title ?? page.title,
      description: page.summary,
      bodyClass: 'legal',
      body,
    }),
  }
}

/**
 * Refuse to publish unfilled placeholders.
 *
 * A privacy policy naming "[CONTACT EMAIL]" as the way to exercise your rights
 * is worse than no policy: it states an obligation and then makes it
 * unreachable. Locally this is a warning so the page can still be previewed;
 * in CI — where the next step is deployment — it fails the build.
 */
function checkPlaceholders(pages) {
  const found = []
  for (const page of pages) {
    for (const match of page.html.matchAll(/\[[A-Z][A-Z ]{3,}\]/g)) {
      found.push(`${page.path}: ${match[0]}`)
    }
  }
  if (!found.length) return

  const message =
    `site: ${found.length} unfilled placeholder(s)\n  ` +
    [...new Set(found)].join('\n  ') +
    '\n  Fill these in before publishing (docs/privacy-policy.md).'

  if (process.env.CI) throw new Error(message)
  console.warn(message)
}

function landingPage() {
  const features = FEATURES.map(
    (f) => `<article class="feature">
    <span class="feature-icon">${icon(f.icon)}</span>
    <h3>${escHtml(f.title)}</h3>
    <p>${inlineCode(f.body)}</p>
  </article>`,
  ).join('')

  const axes = AXES.map(
    ([axis, question, fallback]) =>
      `<tr><td><strong>${axis}</strong></td><td>${question}</td><td>${fallback}</td></tr>`,
  ).join('')

  const exports_ = EXPORTS.map(
    ([subpath, contents, env]) =>
      `<tr><td><code>${escHtml(subpath)}</code></td><td>${contents}</td><td>${env}</td></tr>`,
  ).join('')

  const body = `<main id="content">
<section class="hero">
  <div class="hero-inner">
    <p class="eyebrow"><span class="dot"></span> v${escHtml(VERSION)} · Next 15 &amp; 16 · React 19</p>
    <h1>${escHtml(SITE.tagline)}</h1>
    <p class="lede">${escHtml(SITE.description)}</p>

    <div class="install">${terminal(INSTALL_SESSION)}</div>

    <div class="cta">
      <a class="btn primary" href="${BASE}docs/getting-started/">Get started ${icon('arrow')}</a>
      ${demoButton()}
      <a class="btn" href="${SITE.repo}" target="_blank" rel="noreferrer noopener">${icon('github')} GitHub</a>
    </div>
    ${demoHint()}
  </div>
</section>

<section class="band">
  <div class="band-inner">
    <h2 class="section-title">What you get</h2>
    <p class="section-lede">Six decisions the kit has already made, and the reasoning is in the docs rather than in a fork of it.</p>
    <div class="features">${features}</div>
  </div>
</section>

<section class="band alt">
  <div class="band-inner split">
    <div class="split-copy">
      <h2 class="section-title">Configure it once, in plain data</h2>
      <p>
        <code>AdminConfig</code> is serializable on purpose. Icons are string keys resolved
        through a registry, visibility is declarative, and functions live only in the three
        places <code>serializeConfig()</code> strips at the boundary.
      </p>
      <p>
        That constraint is what makes the rest work: navigation resolves on the server with
        the user's permissions already in hand, so the first paint shows the right menu — no
        client fetch, no flash of items they cannot see. And the CLI can read the same file
        in plain Node to write your docs.
      </p>
      <p><a class="textlink" href="${BASE}docs/configuration/">Read the configuration reference ${icon('arrow')}</a></p>
    </div>
    ${editor({
      lang: 'ts',
      tabs: [
        { name: 'admin.config.ts', code: CONFIG_SAMPLE, active: true },
        { name: 'admin.server.ts', code: SERVER_SAMPLE },
      ],
    })}
  </div>
</section>

<section class="band">
  <div class="band-inner">
    <h2 class="section-title">Three axes, and only one real gate</h2>
    <p class="section-lede">
      Hiding a control is not authorization, and neither is middleware. The axes decide what a
      user <em>sees</em>; the server guards decide what a request <em>gets</em>.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Axis</th><th>Question</th><th>If the source cannot be read</th></tr></thead>
        <tbody>${axes}</tbody>
      </table>
    </div>
    <p class="note">
      Failing open is deliberate: a control-plane read that failed must not lock a paying
      customer out of software they have paid for. Set <code>onUnavailable: 'deny'</code> per axis
      where absence genuinely means no. Anything guarding administration itself fails closed regardless.
    </p>
    <p><a class="textlink" href="${BASE}docs/access-control/">How access control works ${icon('arrow')}</a></p>
  </div>
</section>

<section class="band alt">
  <div class="band-inner">
    <h2 class="section-title">Sub-path exports</h2>
    <p class="section-lede">Each entry point names the environment it belongs to, so a server-only module cannot drift into a client bundle unnoticed.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Sub-path</th><th>Contents</th><th>Environment</th></tr></thead>
        <tbody>${exports_}</tbody>
      </table>
    </div>
    <p><a class="textlink" href="${BASE}docs/api-reference/">Full API reference ${icon('arrow')}</a></p>
  </div>
</section>

<section class="band closing">
  <div class="band-inner">
    <h2 class="section-title">Start with a working install</h2>
    <p class="section-lede">
      <code>admin-kit init</code> scaffolds both config files, the middleware, the login route and
      one page per panel — then <code>examples/app-router</code> shows the same thing finished.
    </p>
    <div class="cta">
      <a class="btn primary" href="${BASE}docs/getting-started/">Getting started ${icon('arrow')}</a>
      ${demoButton()}
      <a class="btn" href="${BASE}docs/">Browse the docs</a>
    </div>
  </div>
</section>
</main>`

  return {
    path: 'index.html',
    html: shell({ base: BASE, title: SITE.name, bodyClass: 'landing', body }),
  }
}

/* --------------------------------- build --------------------------------- */

function build() {
  const started = Date.now()
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const written = []
  const index = []

  const emit = (page) => {
    const target = join(outDir, page.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, page.html, 'utf8')
    written.push(page.path)
  }

  emit(landingPage())
  emit(docsIndexPage())

  const legal = LEGAL_PAGES.map(legalPage)
  legal.forEach(emit)

  PAGES.forEach((page, i) => {
    const built = docPage(page, i)
    emit(built)
    index.push({
      slug: page.slug,
      title: page.title,
      summary: page.summary.replace(/`/g, ''),
      group: page.group,
      url: `${BASE}docs/${page.slug}/`,
      headings: built.headings
        .filter((h) => h.level >= 2 && h.level <= 3)
        .map((h) => ({ text: h.text, id: h.id })),
    })
  })

  writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(index), 'utf8')
  cpSync(join(here, 'assets'), join(outDir, 'assets'), { recursive: true })
  // GitHub Pages runs Jekyll otherwise, which drops files beginning with `_`.
  writeFileSync(join(outDir, '.nojekyll'), '', 'utf8')

  checkLinks(written)
  checkPlaceholders(legal)

  console.log(
    `site: ${written.length + 1} files → site/dist (base ${BASE}) in ${Date.now() - started}ms`,
  )
  if (!SITE.demo) {
    console.log(
      'site: no demo URL set — the "Try the demo" buttons are hidden.\n' +
        '      Deploy examples/app-router, then set SITE.demo in site/content.mjs\n' +
        '      or export SITE_DEMO_URL. See docs/demo.md.',
    )
  }
  return written
}

/**
 * Fail the build on an internal link that goes nowhere.
 *
 * The docs cross-reference each other heavily and are rewritten on the way in,
 * so a renamed page would otherwise ship as a 404 that nobody notices until a
 * reader hits it.
 */
function checkLinks(written) {
  const broken = []

  for (const page of written) {
    const html = readFileSync(join(outDir, page), 'utf8')
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1]
      if (/^(https?:|mailto:|data:|#)/.test(href)) continue

      const path = href.split('#')[0]
      const rel = path.startsWith(BASE) ? path.slice(BASE.length) : path.replace(/^\/+/, '')
      // A clean URL serves the `index.html` inside its directory; a directory
      // that merely exists is not a page, so the file itself has to be there.
      const file = rel === '' || rel.endsWith('/') ? join(outDir, rel, 'index.html') : join(outDir, rel)

      if (!existsSync(file) || !statSync(file).isFile()) broken.push(`${page} → ${href}`)
    }
  }

  if (broken.length) {
    throw new Error(`site: ${broken.length} broken internal link(s)\n  ${broken.join('\n  ')}`)
  }
}

/* --------------------------------- serve --------------------------------- */

/** How many ports to step through before giving up. */
const MAX_PORT_ATTEMPTS = 10

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function serve(port, explicitPort) {
  const server = createServer((req, res) => {
    // Rebuild per navigation: the whole site builds in milliseconds, which is
    // simpler and more reliable than watching for changes.
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (url.startsWith(BASE)) url = `/${url.slice(BASE.length)}`
    if (url.endsWith('/')) url += 'index.html'

    if (url.endsWith('.html')) {
      try {
        build()
      } catch (error) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(String(error.stack ?? error))
        return
      }
    }

    const file = join(outDir, url)
    if (!file.startsWith(outDir) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not found')
      return
    }

    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })

  /*
   * Step to the next free port rather than dying on EADDRINUSE.
   *
   * A preview server left running in another terminal is the normal way this
   * port is taken, and the useful response is to serve on 4322 — not a stack
   * trace telling someone to go hunting for a PID. An explicit `--port` is a
   * request, not a guess, so that one fails loudly instead.
   */
  let attempts = 0

  server.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error
    if (explicitPort || attempts >= MAX_PORT_ATTEMPTS) {
      console.error(
        `site: port ${port + attempts} is already in use` +
          (explicitPort ? '' : ` (tried ${port}–${port + attempts})`),
      )
      process.exit(1)
    }
    attempts++
    console.log(`site: port ${port + attempts - 1} is busy, trying ${port + attempts}`)
    server.listen(port + attempts)
  })

  server.on('listening', () => {
    const actual = server.address().port
    console.log(`site: http://localhost:${actual}${BASE}`)
    if (actual !== port) {
      console.log(`site: ${port} was taken — another preview server is probably still running`)
    }
  })

  server.listen(port)
}

/* ---------------------------------- main --------------------------------- */

build()

if (process.argv.includes('--serve')) {
  const flag = process.argv.indexOf('--port')
  serve(flag === -1 ? 4321 : Number(process.argv[flag + 1]), flag !== -1)
}
