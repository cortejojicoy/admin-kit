/**
 * A small syntax highlighter.
 *
 * The docs are mostly TypeScript and shell, and a real highlighter (shiki,
 * highlight.js) is megabytes of dependency for a site that is otherwise three
 * files of HTML. This tokenizes comments, strings, numbers and keywords —
 * enough for a snippet to read as code — and escapes everything it emits.
 */

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Each family lists its capture groups in order; group N maps to classes[N-1].
 * Order inside the alternation matters: comments and strings must win over
 * keywords, or a keyword inside a string gets coloured.
 */
const FAMILIES = {
  js: {
    // Ordered: comments and strings first so nothing inside them is re-read,
    // then property keys before keywords (a key named `type` is a key, not a
    // keyword), then keywords before call names (`if (` is not a function).
    re: new RegExp(
      [
        '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
        "('(?:\\\\.|[^'\\\\])*'|\"(?:\\\\.|[^\"\\\\])*\"|`(?:\\\\.|[^`\\\\])*`)",
        '(?:[{,[]\\s*|^\\s*)([A-Za-z_$][\\w$]*)\\s*:',
        '\\b(import|export|from|as|const|let|var|function|return|async|await|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|namespace|declare|typeof|instanceof|keyof|satisfies|try|catch|finally|throw|default|void|delete|in|of|null|undefined|true|false|this|super|public|private|protected|readonly|static|abstract|yield)\\b',
        '([A-Za-z_$][\\w$]*)\\s*\\(',
        '\\b(\\d[\\w.]*)\\b',
      ].join('|'),
      'gm', // `m` so a property key can anchor to the start of its own line
    ),
    classes: ['c', 's', 'p', 'k', 'fn', 'n'],
  },
  shell: {
    re: new RegExp(
      [
        '(#[^\\n]*)',
        "('(?:\\\\.|[^'\\\\])*'|\"(?:\\\\.|[^\"\\\\])*\")",
        '(\\s--?[A-Za-z][\\w-]*)',
        '(^|\\n)\\s*(?:npx |pnpm |npm |yarn )?',
      ].join('|'),
      'g',
    ),
    classes: ['c', 's', 'f', ''],
  },
  css: {
    re: new RegExp(
      ['(\\/\\*[\\s\\S]*?\\*\\/)', "('[^']*'|\"[^\"]*\")", '(--[\\w-]+)', '(@[a-z-]+)'].join('|'),
      'g',
    ),
    classes: ['c', 's', 'v', 'k'],
  },
  json: {
    re: new RegExp(
      ['()', '("(?:\\\\.|[^"\\\\])*")', '\\b(-?\\d[\\d.eE+-]*)\\b', '\\b(true|false|null)\\b'].join(
        '|',
      ),
      'g',
    ),
    classes: ['c', 's', 'n', 'k'],
  },
}

const ALIASES = {
  ts: 'js', tsx: 'js', typescript: 'js', js: 'js', jsx: 'js', javascript: 'js',
  bash: 'shell', sh: 'shell', shell: 'shell', console: 'shell',
  css: 'css', json: 'json',
}

export function highlight(code, lang) {
  const family = FAMILIES[ALIASES[(lang || '').toLowerCase()]]
  if (!family) return esc(code)

  let out = ''
  let last = 0
  family.re.lastIndex = 0

  for (const match of code.matchAll(family.re)) {
    // Find which alternative fired; skip purely structural groups.
    const group = family.classes.findIndex((_, i) => match[i + 1] !== undefined)
    if (group === -1 || !family.classes[group]) continue

    const text = match[group + 1]
    const start = match.index + match[0].indexOf(text)
    out += esc(code.slice(last, start))
    out += `<span class="tok-${family.classes[group]}">${esc(text)}</span>`
    last = start + text.length
  }
  return out + esc(code.slice(last))
}

export { esc }
