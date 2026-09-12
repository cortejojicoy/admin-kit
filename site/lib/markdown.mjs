/**
 * A markdown renderer covering the subset these docs are written in:
 * headings, paragraphs, fenced code, GFM tables, lists (nested), blockquotes,
 * rules, and the usual inline marks.
 *
 * Hand-rolled on purpose. The published package has zero runtime dependencies
 * and the site that documents it should not be the reason `pnpm install` grows
 * a markdown toolchain. The input is written in this repository, so the subset
 * is a contract rather than a guess — anything outside it renders as text and
 * the build stays honest about that.
 */
import { esc, highlight } from './highlight.mjs'

/** Sentinel around extracted code spans. NUL cannot occur in the source. */
const MARK = '\u0000'

/* ------------------------------- inline --------------------------------- */

export function inline(src, ctx = {}) {
  const rewriteLink = ctx.rewriteLink ?? ((href) => href)
  const spans = []

  // Code spans come out first, raw, so nothing below can see inside them.
  let text = src.replace(/(`+)([\s\S]*?)\1/g, (_, _ticks, code) => {
    spans.push(`<code>${esc(code.trim())}</code>`)
    return `${MARK}${spans.length - 1}${MARK}`
  })

  text = esc(text)

  // Images before links — the syntax differs by one leading character.
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, href, title) =>
      `<img src="${rewriteLink(href)}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`,
  )

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = rewriteLink(href)
    const external = /^https?:/.test(url)
    return `<a href="${url}"${external ? ' target="_blank" rel="noreferrer noopener"' : ''}>${label}</a>`
  })

  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s([])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s([])_([^_\n]+)_/g, '$1<em>$2</em>')

  return text.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => spans[Number(i)])
}

export function slugify(text) {
  return text
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/* -------------------------------- blocks -------------------------------- */

const LIST_ITEM = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*)$/
const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/
const DELIMITER = /^\s*\|[\s:|-]+\|\s*$/

/** Renders a run of lines. Recursive: list items feed their content back in. */
function renderBlocks(lines, ctx) {
  let html = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    const fence = line.match(FENCE)
    if (fence) {
      const [, indent, ticks, lang] = fence
      const body = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith(ticks.slice(0, 3))) {
        body.push(lines[i].slice(indent.length))
        i++
      }
      i++ // closing fence
      html +=
        `<figure class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}>` +
        `<button class="copy" type="button" aria-label="Copy code">Copy</button>` +
        `<pre><code>${highlight(body.join('\n'), lang)}</code></pre></figure>`
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      const level = heading[1].length
      const raw = heading[2].trim()
      const id = slugify(raw)
      ctx.headings.push({ level, id, text: raw.replace(/`/g, '') })
      html +=
        `<h${level} id="${id}">${inline(raw, ctx)}` +
        `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`
      i++
      continue
    }

    if (RULE.test(line)) {
      html += '<hr>'
      i++
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const body = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        body.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      html += `<blockquote>${renderBlocks(body, ctx)}</blockquote>`
      continue
    }

    // A table is a pipe row whose successor is a delimiter row.
    if (line.trim().startsWith('|') && DELIMITER.test(lines[i + 1] ?? '')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i])
        i++
      }
      html += renderTable(rows, ctx)
      continue
    }

    if (LIST_ITEM.test(line)) {
      const [block, next] = takeList(lines, i)
      html += renderList(block, ctx)
      i = next
      continue
    }

    // Paragraph: up to a blank line or the start of another block.
    const para = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) {
      para.push(lines[i].trim())
      i++
    }
    if (para.length) html += `<p>${inline(para.join(' '), ctx)}</p>`
    else i++ // never stall
  }

  return html
}

function startsBlock(line, next) {
  return (
    HEADING.test(line) ||
    FENCE.test(line) ||
    LIST_ITEM.test(line) ||
    RULE.test(line) ||
    line.trimStart().startsWith('>') ||
    (line.trim().startsWith('|') && DELIMITER.test(next ?? ''))
  )
}

/** Collects the lines belonging to one list, including indented continuations. */
function takeList(lines, start) {
  const first = lines[start].match(LIST_ITEM)
  const baseIndent = first[1].length
  const ordered = Boolean(first[3])

  /**
   * A line at the base indent ends the list unless it is another item of the
   * same kind. Switching between `-` and `1.` starts a new list — otherwise a
   * numbered list following a bulleted one is silently absorbed into it.
   */
  const continuesList = (line) => {
    const item = line.match(LIST_ITEM)
    if (!item) return line.search(/\S/) > baseIndent
    if (item[1].length > baseIndent) return true
    return item[1].length === baseIndent && Boolean(item[3]) === ordered
  }

  const block = []
  let i = start

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      // A blank line stays in only if the list continues after it.
      const following = lines[i + 1] ?? ''
      if (!following.trim() || !continuesList(following)) break
      block.push('')
      i++
      continue
    }

    if (i > start && !continuesList(line)) break
    block.push(line)
    i++
  }

  return [block, i]
}

function renderList(lines, ctx) {
  const first = lines[0].match(LIST_ITEM)
  const baseIndent = first[1].length
  const ordered = Boolean(first[3])
  const items = []
  let current = null
  let loose = false

  for (const line of lines) {
    const item = line.match(LIST_ITEM)
    if (item && item[1].length === baseIndent) {
      current = [item[4]]
      items.push(current)
      continue
    }
    if (!current) continue
    if (!line.trim()) {
      current.push('')
      loose = true
      continue
    }
    // Dedent continuation lines by the marker width, keeping deeper nesting.
    current.push(line.slice(Math.min(line.search(/\S/), baseIndent + 2)))
  }

  let tasks = false

  const rendered = items.map((body) => {
    // GFM task list: `- [ ] …` / `- [x] …`. Rendered disabled, since a
    // checklist in documentation is something to read, not something to tick.
    const task = body[0].match(/^\[([ xX])\]\s+(.*)$/)
    if (task) {
      tasks = true
      body = [task[2], ...body.slice(1)]
    }

    let html = renderBlocks(body, ctx)
    // Tight items: drop the wrapping paragraph so the list stays compact.
    if (!loose) html = html.replace(/^<p>([\s\S]*?)<\/p>/, '$1')

    const box = task
      ? `<input type="checkbox" disabled${task[1] === ' ' ? '' : ' checked'}> `
      : ''
    return `<li${task ? ' class="task"' : ''}>${box}${html}</li>`
  })

  const tag = ordered ? 'ol' : 'ul'
  const cls = [loose ? 'loose' : '', tasks ? 'tasks' : ''].filter(Boolean).join(' ')
  return `<${tag}${cls ? ` class="${cls}"` : ''}>${rendered.join('')}</${tag}>`
}

/** Splits a table row on pipes, leaving pipes inside code spans alone. */
function splitRow(row) {
  const cells = []
  let cell = ''
  let inCode = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '\\' && row[i + 1] === '|') {
      cell += '\\|'
      i++
      continue
    }
    if (ch === '`') inCode = !inCode
    if (ch === '|' && !inCode) {
      cells.push(cell)
      cell = ''
      continue
    }
    cell += ch
  }
  cells.push(cell)
  return cells.slice(1, -1).map((c) => c.trim())
}

function renderTable(rows, ctx) {
  const head = splitRow(rows[0])
  const align = splitRow(rows[1]).map((spec) => {
    const left = spec.startsWith(':')
    const right = spec.endsWith(':')
    if (left && right) return 'center'
    return right ? 'right' : ''
  })
  const cls = (i) => (align[i] ? ` class="ta-${align[i]}"` : '')

  const th = head.map((cell, i) => `<th${cls(i)}>${inline(cell, ctx)}</th>`).join('')
  const tr = rows
    .slice(2)
    .map(splitRow)
    .map((cells) => `<tr>${cells.map((c, i) => `<td${cls(i)}>${inline(c, ctx)}</td>`).join('')}</tr>`)
    .join('')

  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`
}

/**
 * @returns {{ html: string, headings: Array<{level:number,id:string,text:string}>, title: string|null }}
 */
export function renderMarkdown(source, options = {}) {
  const ctx = { headings: [], rewriteLink: options.rewriteLink }
  const body = source.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '')
  const html = renderBlocks(body.split('\n'), ctx)
  const title = ctx.headings.find((h) => h.level === 1)?.text ?? null
  return { html, headings: ctx.headings, title }
}
