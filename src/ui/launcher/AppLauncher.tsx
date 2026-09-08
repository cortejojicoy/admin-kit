'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAccess } from '../../access/AccessProvider'
import { useOptionalAuth } from '../../auth/useAuth'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { useRouterBridge } from '../../context/RouterContext'
import { dockModules, tileModules } from '../../modules/catalog'
import type { ModuleDescriptor } from '../../modules/types'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'
import { EmptyState } from '../primitives'
import { Dock, QuickAccessBar } from './QuickAccess'

export interface AppLauncherProps {
  /** Replaces the greeting block. */
  header?: ReactNode
  /** Rightmost control in the dock — the one action that creates a record. */
  primaryAction?: ReactNode
  /** Shown when the user has access to no modules at all. */
  empty?: ReactNode
  className?: string
}

/**
 * The launcher home: a header over a grid of module tiles, with the dock at the
 * bottom of the scrollport.
 *
 * Tiles are the modules people *run their shift from*; the dock holds the
 * stations they step into and back out of. Both come from the same descriptors
 * and the same access engine, so what a user sees here is exactly what their
 * permissions allow and nothing needs a second opinion.
 */
export function AppLauncher({ header, primaryAction, empty, className }: AppLauncherProps) {
  const config = useAdminConfig()
  const access = useAccess()

  const visible = useMemo(
    () =>
      config.modules.filter((m) =>
        access.moduleVisible({ code: m.code, accessCodes: m.accessCodes, requiredLevel: m.requiredLevel }),
      ),
    [config.modules, access],
  )

  const tiles = useMemo(() => tileModules(visible), [visible])
  const dock = useMemo(() => dockModules(visible, config.panels.app.dockOrder), [visible, config.panels.app.dockOrder])

  // The featured layout needs *both* halves. A user holding only the primary
  // module would otherwise get a two-thirds-width tile beside a gap, so the
  // layout degrades to an even grid by permission rather than by breakpoint.
  const primary = tiles.find((m) => m.emphasis === 'primary')
  const critical = tiles.find((m) => m.emphasis === 'critical')
  const featured = Boolean(primary && critical)
  const rest = featured ? tiles.filter((m) => m !== primary && m !== critical) : tiles

  return (
    <div className={cn('ak-hub', className)}>
      {header ?? (config.panels.app.greeting ? <LauncherGreeting /> : null)}

      {tiles.length === 0 && dock.length === 0 ? (
        <EmptyState>{empty ?? 'You do not have access to any modules yet.'}</EmptyState>
      ) : (
        <section aria-label="Modules">
          {featured ? (
            <div className="ak-hub__featured">
              <LauncherTile module={primary!} />
              <LauncherTile module={critical!} />
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div className="ak-hub__grid">
              {rest.map((mod) => (
                <LauncherTile key={mod.code} module={mod} />
              ))}
            </div>
          ) : null}
        </section>
      )}

      <Dock>
        <QuickAccessBar modules={dock} />
        {primaryAction}
      </Dock>
    </div>
  )
}

export function LauncherTile({ module: mod, className }: { module: ModuleDescriptor; className?: string }) {
  const { Link } = useRouterBridge()
  return (
    <Link
      href={mod.href}
      className={cn('ak-tile', className)}
      data-emphasis={mod.emphasis}
      data-tone={mod.tone}
    >
      <div className="ak-tile__head">
        <span className="ak-tile__icon">
          <Icon iconKey={mod.iconKey} />
        </span>
        <h2 className="ak-tile__title">{mod.title}</h2>
      </div>
      {typeof mod.description === 'string' ? (
        <p className="ak-tile__description">{mod.description}</p>
      ) : null}
      {mod.stats?.length ? (
        <div className="ak-tile__stats">
          {mod.stats.map((stat) => (
            <div className="ak-tile__stat" key={stat.label}>
              <div className="ak-tile__stat-value">{stat.value}</div>
              <div className="ak-tile__stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </Link>
  )
}

export interface LauncherGreetingProps {
  /** Overrides the time-of-day greeting. */
  title?: ReactNode
  subtitle?: ReactNode
  /** Formats the user's name — honorifics, surnames-first, and so on. */
  formatName?: (user: { name?: string; email?: string } | null) => string
}

/**
 * A time-of-day greeting.
 *
 * Rendered client-side from the browser's own clock, which is the only clock
 * that can say "good morning" correctly for a user in a different timezone
 * from the server.
 *
 * Anything domain-specific — professional honorifics, role-based subtitles —
 * belongs in `formatName` or in a replacement `header`, not in this package.
 */
export function LauncherGreeting({ title, subtitle, formatName }: LauncherGreetingProps) {
  const config = useAdminConfig()
  const auth = useOptionalAuth()
  const user = auth?.user ?? null

  const name = formatName ? formatName(user) : (user?.name || user?.email || '')

  return (
    <header>
      <h1 className="ak-hub__greeting">
        {title ?? (name ? `${timeGreeting()}, ${name}` : timeGreeting())}
      </h1>
      <p className="ak-hub__subtitle">{subtitle ?? config.app.description ?? null}</p>
    </header>
  )
}

function timeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
