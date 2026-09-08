import { describe, expect, it } from 'vitest'
import { buildNav, modulesToSections } from '../src/navigation/buildNav'
import { filterNav } from '../src/navigation/filterNav'
import { createAccessEngine } from '../src/access/engine'
import type { AccessSnapshot } from '../src/access/types'
import type { NavSection } from '../src/navigation/types'

const engineFor = (partial: Partial<AccessSnapshot> = {}) =>
  createAccessEngine({ permissions: {}, entitlements: null, roles: [], isAdmin: false, ...partial })

describe('buildNav', () => {
  it('merges sections that share an id', () => {
    const sections = buildNav({
      sections: [{ id: 'workspace', label: 'Workspace', items: [{ label: 'Home', href: '/' }] }],
      plugins: [
        { id: 'billing', navSections: [{ id: 'workspace', items: [{ label: 'Invoices', href: '/invoices' }] }] },
      ],
    })
    expect(sections).toHaveLength(1)
    expect(sections[0].items.map((i) => i.label)).toEqual(['Home', 'Invoices'])
  })

  it('keeps the consumer label when a plugin merges into their section', () => {
    // A plugin appending items should not get to rename the section it joined.
    const sections = buildNav({
      sections: [{ id: 'ops', label: 'Operations', items: [{ label: 'A' }] }],
      plugins: [{ id: 'p', navSections: [{ id: 'ops', label: 'Plugin Name', items: [{ label: 'B' }] }] }],
    })
    expect(sections[0].label).toBe('Operations')
  })

  it('keeps anonymous sections separate', () => {
    const sections = buildNav({
      sections: [{ items: [{ label: 'A' }] }, { items: [{ label: 'B' }] }],
    })
    expect(sections).toHaveLength(2)
  })

  it('sorts by order and falls back to declaration order', () => {
    const sections = buildNav({
      sections: [
        { id: 'c', items: [{ label: 'C' }] },
        { id: 'a', order: -1, items: [{ label: 'A' }] },
        { id: 'b', items: [{ label: 'B' }] },
      ],
    })
    expect(sections.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts items stably within a section', () => {
    const sections = buildNav({
      sections: [
        {
          id: 's',
          items: [
            { label: 'third', order: 2 },
            { label: 'first', order: 1 },
            { label: 'also-first', order: 1 },
          ],
        },
      ],
    })
    expect(sections[0].items.map((i) => i.label)).toEqual(['first', 'also-first', 'third'])
  })

  it('folds modules in as items grouped by group', () => {
    const sections = modulesToSections(
      [
        { code: 'A', title: 'Alpha', href: '/a', group: 'ops' },
        { code: 'B', title: 'Beta', href: '/b', group: 'ops' },
        { code: 'C', title: 'Gamma', href: '/c', group: 'finance' },
        { code: 'H', title: 'Hidden', href: '/h', placement: 'hidden' },
      ],
      { ops: 'Operations', finance: 'Finance' },
      ['finance', 'ops'],
    )
    expect(sections.map((s) => s.label)).toEqual(['Operations', 'Finance'])
    expect(sections.find((s) => s.label === 'Finance')?.order).toBe(0)
    expect(sections.flatMap((s) => s.items).map((i) => i.label)).not.toContain('Hidden')
  })

  it('carries a module code onto the item as an access code', () => {
    const [section] = modulesToSections([
      { code: 'BILLING', title: 'Billing', href: '/billing', accessCodes: ['CLAIMS'] },
    ])
    expect(section.items[0].accessCodes).toEqual(['BILLING', 'CLAIMS'])
  })
})

describe('filterNav', () => {
  const sections: NavSection[] = [
    {
      id: 'main',
      label: 'Main',
      items: [
        { label: 'Home', href: '/' },
        { label: 'Users', href: '/users', permissions: ['users:list'] },
        { label: 'Hidden', href: '/hidden', hidden: true },
        {
          label: 'Reports',
          children: [
            { label: 'Daily', href: '/reports/daily', permissions: ['reports:daily'] },
            { label: 'Yearly', href: '/reports/yearly', permissions: ['reports:yearly'] },
          ],
        },
      ],
    },
    { id: 'admin', label: 'Admin', items: [{ label: 'Settings', href: '/settings' }], roles: ['admin'] },
  ]

  it('keeps unguarded items and drops denied ones', () => {
    const result = filterNav(sections, engineFor({ permissions: { 'users:list': 'view' } }))
    const labels = result.flatMap((s) => s.items).map((i) => i.label)
    expect(labels).toContain('Home')
    expect(labels).toContain('Users')
    expect(labels).not.toContain('Hidden')
  })

  it('drops a section whose role the user lacks', () => {
    const result = filterNav(sections, engineFor({ permissions: {} }))
    expect(result.map((s) => s.id)).not.toContain('admin')
  })

  it('keeps a role-gated section for an administrator', () => {
    const result = filterNav(sections, engineFor({ roles: ['admin'] }))
    expect(result.map((s) => s.id)).toContain('admin')
  })

  it('prunes a group whose children are all denied', () => {
    const result = filterNav(sections, engineFor({ permissions: {} }))
    const labels = result.flatMap((s) => s.items).map((i) => i.label)
    expect(labels).not.toContain('Reports')
  })

  it('keeps a group with one permitted child, and only that child', () => {
    const result = filterNav(sections, engineFor({ permissions: { 'reports:daily': 'view' } }))
    const reports = result.flatMap((s) => s.items).find((i) => i.label === 'Reports')
    expect(reports?.children?.map((c) => c.label)).toEqual(['Daily'])
  })

  it('drops an empty section rather than rendering a bare heading', () => {
    const result = filterNav(
      [{ id: 'only', label: 'Only', items: [{ label: 'X', permissions: ['nope'] }] }],
      engineFor({ permissions: {} }),
    )
    expect(result).toEqual([])
  })

  it('requires every kind of constraint but any value within a kind', () => {
    const guarded: NavSection[] = [
      { items: [{ label: 'Both', href: '/x', roles: ['editor'], permissions: ['a', 'b'] }] },
    ]
    // Right permission, wrong role → denied.
    expect(filterNav(guarded, engineFor({ permissions: { a: 'view' } }))).toEqual([])
    // Right role, no permission → denied.
    expect(filterNav(guarded, engineFor({ roles: ['editor'], permissions: {} }))).toEqual([])
    // Either permission satisfies the OR within the kind.
    expect(
      filterNav(guarded, engineFor({ roles: ['editor'], permissions: { b: 'view' } })),
    ).toHaveLength(1)
  })

  it('honours requiredLevel', () => {
    const guarded: NavSection[] = [
      { items: [{ label: 'Write', href: '/w', permissions: ['x'], requiredLevel: 'full' }] },
    ]
    expect(filterNav(guarded, engineFor({ permissions: { x: 'view' } }))).toEqual([])
    expect(filterNav(guarded, engineFor({ permissions: { x: 'full' } }))).toHaveLength(1)
  })
})
