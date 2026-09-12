/*
 * Progressive enhancement only. Every page is complete without this file:
 * it adds the theme toggle, copy buttons, the sidebar filter, scroll-spy on
 * the "on this page" rail, and search over a small index built at build time.
 */
;(function () {
  'use strict'

  var BASE = window.__AK_BASE__ || '/'

  /* ------------------------------- theme -------------------------------- */

  var toggle = document.querySelector('.theme-toggle')
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme')
      if (!current) {
        // No explicit choice yet: flip away from whatever the OS is giving.
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        current = dark ? 'dark' : 'light'
      }
      var next = current === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('ak-theme', next)
      } catch (e) {
        /* private browsing — the toggle still works for this page */
      }
    })
  }

  /* ---------------------------- copy buttons ---------------------------- */

  document.querySelectorAll('.copy').forEach(function (button) {
    button.addEventListener('click', function () {
      // Scoped to the figure, not the button's parent: in the editor chrome the
      // button is a sibling of the tab strip, not of the code. The visible pane
      // comes first so a multi-tab editor copies the file you are looking at,
      // and querying `code` skips the gutter, which has no <code> inside it.
      var figure = button.closest('figure')
      if (!figure) return
      var code =
        figure.querySelector('.editor-pane:not([hidden]) code') || figure.querySelector('code')
      if (!code) return
      var write = navigator.clipboard
        ? navigator.clipboard.writeText(code.textContent)
        : Promise.reject()

      write.then(
        function () {
          button.textContent = 'Copied'
          button.classList.add('done')
          setTimeout(function () {
            button.textContent = 'Copy'
            button.classList.remove('done')
          }, 1600)
        },
        function () {
          button.textContent = 'Press ⌘C'
          setTimeout(function () {
            button.textContent = 'Copy'
          }, 1600)
        },
      )
    })
  })

  /* ---------------------------- editor tabs ----------------------------- */

  document.querySelectorAll('.editor').forEach(function (ed) {
    var tabs = Array.prototype.slice.call(ed.querySelectorAll('[role="tab"]'))
    if (tabs.length < 2) return

    var status = ed.querySelector('.status-end')

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index
        var pane = document.getElementById(tab.getAttribute('aria-controls'))

        tab.classList.toggle('is-active', on)
        tab.setAttribute('aria-selected', String(on))
        tab.tabIndex = on ? 0 : -1
        if (pane) pane.hidden = !on

        // The status bar describes the open file, so it follows the tab.
        if (on && pane && status) status.textContent = 'Ln ' + pane.dataset.lines + ', Col 1'
      })
      if (focus) tabs[index].focus()
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        select(i)
      })
      tab.addEventListener('keydown', function (event) {
        var delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
        if (!delta) return
        event.preventDefault()
        select((i + delta + tabs.length) % tabs.length, true)
      })
    })
  })

  /* --------------------------- mobile sidebar --------------------------- */

  var navToggle = document.querySelector('.sidebar-toggle')
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open')
      navToggle.setAttribute('aria-expanded', String(open))
    })
  }

  /* --------------------------- sidebar filter --------------------------- */

  var filter = document.querySelector('.nav-filter input')
  if (filter) {
    var empty = document.querySelector('.nav-empty')
    filter.addEventListener('input', function () {
      var term = filter.value.trim().toLowerCase()
      var hits = 0

      document.querySelectorAll('.nav-group').forEach(function (group) {
        var shown = 0
        group.querySelectorAll('li').forEach(function (li) {
          var link = li.querySelector('a')
          var haystack = (link.getAttribute('data-nav-title') || link.textContent).toLowerCase()
          var match = !term || haystack.indexOf(term) !== -1
          li.hidden = !match
          if (match) shown++
        })
        group.hidden = shown === 0
        hits += shown
      })

      if (empty) empty.hidden = hits !== 0
    })
  }

  /* ------------------------------ scroll-spy ---------------------------- */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'))
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {}
    tocLinks.forEach(function (link) {
      byId[link.getAttribute('href').slice(1)] = link
    })

    var targets = Object.keys(byId)
      .map(function (id) {
        return document.getElementById(id)
      })
      .filter(Boolean)

    var visible = []
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.id
          var at = visible.indexOf(id)
          if (entry.isIntersecting && at === -1) visible.push(id)
          if (!entry.isIntersecting && at !== -1) visible.splice(at, 1)
        })

        // Mark the topmost heading currently in view; falling back to the last
        // one passed keeps the rail from going blank between sections.
        var active = targets
          .map(function (el) {
            return el.id
          })
          .filter(function (id) {
            return visible.indexOf(id) !== -1
          })[0]

        if (!active) return
        tocLinks.forEach(function (link) {
          link.classList.toggle('active', link === byId[active])
        })
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )

    targets.forEach(function (el) {
      observer.observe(el)
    })
  }

  /* -------------------------------- search ------------------------------ */

  var overlay = document.querySelector('.search-overlay')
  if (!overlay) return

  var input = overlay.querySelector('input')
  var results = overlay.querySelector('.search-results')
  var noHits = overlay.querySelector('.search-empty')
  var index = null
  var cursor = 0

  function open() {
    overlay.hidden = false
    input.value = ''
    render([])
    input.focus()
    load()
  }

  function close() {
    overlay.hidden = true
  }

  function load() {
    if (index) return
    fetch(BASE + 'search-index.json')
      .then(function (r) {
        return r.json()
      })
      .then(function (data) {
        index = data
      })
      .catch(function () {
        index = []
      })
  }

  /** Pages first, then the headings inside them — both matched on substring. */
  function search(term) {
    if (!index || !term) return []
    var q = term.toLowerCase()
    var out = []

    index.forEach(function (page) {
      if ((page.title + ' ' + page.summary).toLowerCase().indexOf(q) !== -1) {
        out.push({ url: page.url, title: page.title, context: page.group })
      }
      page.headings.forEach(function (h) {
        if (h.text.toLowerCase().indexOf(q) !== -1) {
          out.push({ url: page.url + '#' + h.id, title: h.text, context: page.title })
        }
      })
    })

    return out.slice(0, 12)
  }

  function render(items) {
    cursor = 0
    results.innerHTML = items
      .map(function (item, i) {
        return (
          '<li' +
          (i === 0 ? ' class="active"' : '') +
          '><a href="' +
          item.url +
          '"><strong></strong><span></span></a></li>'
        )
      })
      .join('')

    // Titles are set as text, never as markup — the index is data.
    Array.prototype.forEach.call(results.children, function (li, i) {
      li.querySelector('strong').textContent = items[i].title
      li.querySelector('span').textContent = items[i].context
    })

    if (noHits) noHits.hidden = !(input.value.trim() && items.length === 0)
  }

  function move(delta) {
    var items = results.children
    if (!items.length) return
    items[cursor].classList.remove('active')
    cursor = (cursor + delta + items.length) % items.length
    items[cursor].classList.add('active')
    items[cursor].scrollIntoView({ block: 'nearest' })
  }

  input.addEventListener('input', function () {
    render(search(input.value.trim()))
  })

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) close()
  })

  overlay.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      var active = results.children[cursor]
      if (active) {
        event.preventDefault()
        active.querySelector('a').click()
      }
    }
  })

  document.querySelectorAll('.search-open').forEach(function (button) {
    button.addEventListener('click', open)
  })

  document.addEventListener('keydown', function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
    if ((event.key === '/' || (event.key === 'k' && (event.metaKey || event.ctrlKey))) && !typing) {
      event.preventDefault()
      open()
    }
  })
})()
