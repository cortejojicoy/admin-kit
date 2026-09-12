/**
 * The page shell: one <head>, one topbar, one footer, shared by every page.
 *
 * Pages are plain strings of HTML. There is no client framework here on
 * purpose — a documentation site for a library should be readable with
 * JavaScript switched off, and the only script on the page enhances search,
 * the theme toggle and the copy buttons.
 */
import { SITE, NAV, LEGAL_PAGES } from '../content.mjs'
import { highlight } from './highlight.mjs'

/** Inline SVGs, 24×24, stroked so they inherit `currentColor`. */
export const ICONS = {
  plug: '<path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9ZM12 18v3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  panels: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/>',
  data: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  brush: '<path d="M4 20c2 0 3-1 3-3a2 2 0 1 0-3 3ZM8.5 15.5 19 5a2.1 2.1 0 0 0-3-3L5.5 12.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M8 7h7M8 11h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  github: '<path d="M9 19c-4 1.2-4-2.2-6-2.7m12 5v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.5 2.9 5.5 3.2 5.5 3.2a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.7c0 4.6 2.8 5.6 5.5 6a3 3 0 0 0-.8 2.3V21"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5 16 12l-6 3.5V8.5Z"/>',
}

export const icon = (name, extra = '') =>
  `<svg class="icon${extra ? ` ${extra}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`

/**
 * Renders one page.
 *
 * @param {object} page
 * @param {string} page.title      Browser title, before the site name.
 * @param {string} page.body       The page's own markup.
 * @param {string} page.base       Site base path, always ending in `/`.
 * @param {string} [page.description]
 * @param {string} [page.bodyClass]
 * @param {string} [page.active]   Slug of the current docs page, for the sidebar.
 */
export function shell(page) {
  const { base, title, body, description = SITE.description, bodyClass = '', active = null } = page
  const fullTitle = title === SITE.name ? `${SITE.name} — ${SITE.tagline}` : `${title} · ${SITE.name}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escAttr(fullTitle)}</title>
<meta name="description" content="${escAttr(description)}">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${escAttr(fullTitle)}">
<meta property="og:description" content="${escAttr(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<link rel="stylesheet" href="${base}assets/site.css">
<script>
  // Applied before first paint so a dark-mode reader never sees a white flash.
  try {
    var t = localStorage.getItem('ak-theme')
    if (t) document.documentElement.setAttribute('data-theme', t)
  } catch (e) {}
  window.__AK_BASE__ = ${JSON.stringify(base)}
</script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#content">Skip to content</a>
${topbar(base, active !== null)}
${body}
${footer(base)}
${searchDialog()}
<script src="${base}assets/site.js" defer></script>
</body>
</html>
`
}

/** The search overlay. Populated at runtime from `search-index.json`. */
function searchDialog() {
  return `<div class="search-overlay" hidden>
  <div class="search-box" role="dialog" aria-modal="true" aria-label="Search documentation">
    <label class="search-field">
      ${icon('search')}
      <input type="search" placeholder="Search the documentation" aria-label="Search documentation" autocomplete="off">
      <kbd>Esc</kbd>
    </label>
    <ul class="search-results" role="listbox"></ul>
    <p class="search-empty" hidden>Nothing matched.</p>
  </div>
</div>`
}

const FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#2f6fed"/><g fill="#fff"><rect x="5" y="5" width="6" height="14" rx="1.5"/><rect x="13" y="5" width="6" height="6" rx="1.5"/><rect x="13" y="13" width="6" height="6" rx="1.5"/></g></svg>'

function topbar(base, inDocs) {
  return `<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="${base}">
      <span class="brand-mark" aria-hidden="true">${icon('panels')}</span>
      <span class="brand-name">${SITE.name}</span>
    </a>
    <nav class="topnav" aria-label="Primary">
      <a href="${base}docs/"${inDocs ? ' aria-current="page"' : ''}>Docs</a>
      <a href="${base}docs/getting-started/">Getting started</a>
      <a href="${base}docs/api-reference/">API</a>
    </nav>
    <div class="topbar-actions">
      <button class="search-open" type="button" aria-label="Search documentation">
        ${icon('search')}<span>Search</span><kbd>/</kbd>
      </button>
      <a class="iconbtn" href="${SITE.repo}" target="_blank" rel="noreferrer noopener" aria-label="GitHub repository">${icon('github')}</a>
      <button class="iconbtn theme-toggle" type="button" aria-label="Switch theme">${icon('sun', 'only-light')}${icon('moon', 'only-dark')}</button>
      ${inDocs ? `<button class="iconbtn sidebar-toggle" type="button" aria-label="Show navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>` : ''}
    </div>
  </div>
</header>`
}

function footer(base) {
  return `<footer class="footer">
  <div class="footer-inner">
    <p><strong>${SITE.name}</strong> — ${SITE.license} licensed. <code>${SITE.pkg}</code></p>
    <nav aria-label="Footer">
      <a href="${base}docs/">Documentation</a>
      <a href="${SITE.repo}" target="_blank" rel="noreferrer noopener">GitHub</a>
      <a href="${SITE.npm}" target="_blank" rel="noreferrer noopener">npm</a>
      <a href="${SITE.repo}/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer noopener">Changelog</a>
      ${LEGAL_PAGES.map((p) => `<a href="${base}${p.path}/">${escHtml(p.title)}</a>`).join('\n      ')}
    </nav>
  </div>
</footer>`
}

/** The docs sidebar, with the current page marked. */
export function sidebar(base, active) {
  const groups = NAV.map(
    (group) => `<div class="nav-group">
    <h2>${group.title}</h2>
    <ul>${group.items
      .map(
        (item) =>
          `<li><a href="${base}docs/${item.slug}/"${
            item.slug === active ? ' aria-current="page"' : ''
          } data-nav-title="${escAttr(item.title)} ${escAttr(item.summary.replace(/`/g, ''))}">${item.title}</a></li>`,
      )
      .join('')}</ul>
  </div>`,
  ).join('')

  return `<aside class="sidebar" id="sidebar">
  <nav aria-label="Documentation">
    <label class="nav-filter">
      ${icon('search')}
      <input type="search" placeholder="Filter pages" aria-label="Filter pages">
    </label>
    ${groups}
    <p class="nav-empty" hidden>No pages match.</p>
  </nav>
</aside>`
}

/** The "on this page" rail. h2 and h3 only — deeper is noise in a rail. */
export function toc(headings) {
  const items = headings.filter((h) => h.level === 2 || h.level === 3)
  if (items.length < 2) return '<div class="toc"></div>'

  return `<nav class="toc" aria-label="On this page">
  <h2>On this page</h2>
  <ul>${items
    .map((h) => `<li class="lvl-${h.level}"><a href="#${h.id}">${escHtml(h.text)}</a></li>`)
    .join('')}</ul>
</nav>`
}

/* -------------------------------- editor -------------------------------- */

const LANG_LABEL = { ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', json: 'JSON' }

/** File-type glyphs, drawn rather than imported so the chrome costs nothing. */
const FILE_BADGE = {
  ts: '<span class="badge-ts">TS</span>',
  tsx: '<span class="badge-ts">TSX</span>',
  js: '<span class="badge-js">JS</span>',
  json: '<span class="badge-js">{ }</span>',
}

let editorSeq = 0

/**
 * A code block dressed as an editor window: title bar, file tabs, a line-number
 * gutter and a status bar.
 *
 * The chrome is not decoration here — the config snippet's whole point is that
 * it is one of *two* files, so a reader who clicks the second tab sees the
 * split rather than being told about it. Tabs are real buttons over real
 * panels; with no JavaScript the first file simply stays open.
 *
 * Line numbers live in their own element with no `<code>` inside, which is what
 * keeps them out of the copy button's reach.
 *
 * @param {{ lang: string, tabs: Array<{ name: string, code: string, active?: boolean }> }} spec
 */
export function editor({ lang, tabs }) {
  const uid = `ed${++editorSeq}`
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.active),
  )

  const tabStrip = tabs
    .map((tab, i) => {
      const on = i === activeIndex
      return (
        `<button type="button" role="tab" class="editor-tab${on ? ' is-active' : ''}"` +
        ` id="${uid}-t${i}" aria-controls="${uid}-p${i}" aria-selected="${on}"` +
        ` tabindex="${on ? '0' : '-1'}">${FILE_BADGE[lang] ?? ''}${escHtml(tab.name)}</button>`
      )
    })
    .join('')

  const panes = tabs
    .map((tab, i) => {
      const lines = tab.code.split('\n')
      return (
        `<div class="editor-pane" role="tabpanel" id="${uid}-p${i}"` +
        ` aria-labelledby="${uid}-t${i}" data-lines="${lines.length}"${i === activeIndex ? '' : ' hidden'}>` +
        `<pre class="editor-gutter" aria-hidden="true">${lines.map((_, n) => n + 1).join('\n')}</pre>` +
        `<pre class="editor-code"><code>${highlight(tab.code, lang)}</code></pre></div>`
      )
    })
    .join('')

  const activeLines = tabs[activeIndex].code.split('\n').length

  return `<figure class="editor">
  <div class="editor-chrome">
    <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="editor-tabs" role="tablist" aria-label="Configuration files">${tabStrip}</div>
    <button class="copy" type="button" aria-label="Copy code">Copy</button>
  </div>
  <div class="editor-body">${panes}</div>
  <div class="editor-status" aria-hidden="true">
    <span>${LANG_LABEL[lang] ?? lang}</span>
    <span>UTF-8</span>
    <span>Spaces: 2</span>
    <span class="status-end">Ln ${activeLines}, Col 1</span>
  </div>
</figure>`
}

/**
 * A shell session dressed as a macOS terminal window.
 *
 * Prompts are drawn with `::before`, not written into the markup, so copying
 * the block yields commands you can paste rather than a transcript you have to
 * clean up first.
 *
 * @param {{ title: string, lines: Array<{ comment?: string, cmd?: string, out?: string }> }} spec
 */
export function terminal({ title, lines }) {
  const body = lines
    .map((line) => {
      if (line.comment) return `<span class="term-comment"># ${escHtml(line.comment)}</span>`
      if (line.out) return `<span class="term-out">${escHtml(line.out)}</span>`
      return `<span class="term-cmd">${escHtml(line.cmd)}</span>`
    })
    .join('\n')

  return `<figure class="terminal">
  <div class="terminal-chrome">
    <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="terminal-title">${escHtml(title)}</span>
    <button class="copy" type="button" aria-label="Copy commands">Copy</button>
  </div>
  <pre class="terminal-body"><code>${body}</code></pre>
</figure>`
}

export const escHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const escAttr = (s) => escHtml(s).replace(/"/g, '&quot;')
