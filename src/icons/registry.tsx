'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ComponentType, ReactNode, SVGProps } from 'react'

/**
 * Icons cross the server/client boundary as **string keys**, and the boundary
 * is exactly why.
 *
 * A component is not serializable, so a config that types `icon` as a
 * `ReactNode` can never be built on the server — where the user's permissions
 * already are — and handed to a client shell. Keys are plain strings, so the
 * config stays data and each renderer resolves the key against this registry.
 *
 * Consumers register their own set once:
 *
 *   <AdminProvider icons={{ users: UsersIcon, billing: ReceiptIcon }}>
 *
 * An unknown key renders the fallback rather than nothing, so a typo in config
 * looks like a wrong icon instead of a mysteriously missing one.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>
export type IconRegistry = Record<string, IconComponent>

const IconContext = createContext<IconRegistry>({})

export interface IconProviderProps {
  icons?: IconRegistry
  children: ReactNode
}

export function IconProvider({ icons, children }: IconProviderProps) {
  const parent = useContext(IconContext)
  const merged = useMemo(() => ({ ...BUILTIN_ICONS, ...parent, ...icons }), [parent, icons])
  return <IconContext.Provider value={merged}>{children}</IconContext.Provider>
}

export function useIconRegistry(): IconRegistry {
  return useContext(IconContext)
}

/** Resolve one key. Returns the fallback when the key is unknown or unset. */
export function useIcon(key: string | undefined): IconComponent {
  const registry = useIconRegistry()
  if (!key) return FallbackIcon
  return registry[key] ?? BUILTIN_ICONS[key] ?? FallbackIcon
}

/**
 * Render an icon by key.
 *
 * The lint rule below fires on any component resolved during render, which is
 * exactly what a registry does — the component comes from a stable map keyed by
 * a string, it is not constructed here, so its identity is as stable as a direct
 * import. Resolving keys to components is the whole point of the registry: it
 * is what lets the config stay serializable.
 */
export function Icon({ iconKey, ...props }: { iconKey?: string } & SVGProps<SVGSVGElement>) {
  const Component = useIcon(iconKey)
  // eslint-disable-next-line react-hooks/static-components
  return <Component aria-hidden focusable="false" {...props} />
}

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: '1em',
  height: '1em',
}

function make(path: ReactNode): IconComponent {
  const Component = (props: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...props}>
      {path}
    </svg>
  )
  return Component
}

const FallbackIcon = make(<circle cx="12" cy="12" r="8" />)

/**
 * A deliberately small built-in set: enough that the default panels, the
 * generated CRUD screens and the scaffolded pages all render with real icons
 * out of the box, and not so many that the package turns into an icon library.
 * Anything else comes from the consumer's own set.
 */
export const BUILTIN_ICONS: IconRegistry = {
  fallback: FallbackIcon,
  dashboard: make(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>,
  ),
  users: make(
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M18 14.2A5.5 5.5 0 0 1 21.5 20" />
    </>,
  ),
  user: make(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>,
  ),
  settings: make(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" />
    </>,
  ),
  shield: make(<path d="M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5-4.6-1.2-8-4.5-8-9.5V6z" />),
  key: make(
    <>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5 20 3M16 3h4v4" />
    </>,
  ),
  list: make(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />),
  table: make(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </>,
  ),
  plus: make(<path d="M12 5v14M5 12h14" />),
  edit: make(<path d="M4 20h4L20 8l-4-4L4 16z" />),
  trash: make(
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>,
  ),
  search: make(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>,
  ),
  bell: make(
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>,
  ),
  home: make(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />),
  chevronLeft: make(<path d="M14.5 5.5 8 12l6.5 6.5" />),
  chevronRight: make(<path d="M9.5 5.5 16 12l-6.5 6.5" />),
  chevronDown: make(<path d="M5.5 9.5 12 16l6.5-6.5" />),
  menu: make(<path d="M4 7h16M4 12h16M4 17h16" />),
  logout: make(
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </>,
  ),
  grid: make(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>,
  ),
  activity: make(<path d="M3 12h4l2.5-7 4 14 2.5-7h5" />),
  alert: make(
    <>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17h.01" />
    </>,
  ),
  check: make(<path d="M5 12.5 10 17.5 19.5 7" />),
  close: make(<path d="M6 6l12 12M18 6 6 18" />),
  database: make(
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>,
  ),
  document: make(
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 13h6M9 17h6" />
    </>,
  ),
}
