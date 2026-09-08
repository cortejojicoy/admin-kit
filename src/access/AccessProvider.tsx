'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createAccessEngine, type AccessEngine, type ModuleAccessShape } from './engine'
import { EMPTY_SNAPSHOT, type AccessConfig, type AccessSnapshot } from './types'
import type { AccessLevel } from './levels'

/**
 * Access, hydrated from the server.
 *
 * The snapshot is resolved during the server render — where the session and the
 * permissions endpoint already are — and passed down as plain data. No client
 * fetch, so nav does not flash the wrong items while a permissions request is
 * in flight, and the tree the client filters is the same one the server's page
 * guards used.
 */
const AccessContext = createContext<AccessEngine | null>(null)

export interface AccessProviderProps {
  snapshot?: AccessSnapshot
  config?: AccessConfig
  /** Supply an engine directly (tests, or a wholly custom policy). */
  engine?: AccessEngine
  children: ReactNode
}

export function AccessProvider({ snapshot, config, engine, children }: AccessProviderProps) {
  const value = useMemo(
    () => engine ?? createAccessEngine(snapshot ?? EMPTY_SNAPSHOT, config ?? {}),
    [engine, snapshot, config],
  )
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

/**
 * The access engine.
 *
 * Falls back to a permissive engine rather than throwing when there is no
 * provider: a component asking "may I?" outside the tree should not take the
 * page down, and the server-side guards are the real gate regardless.
 */
export function useAccess(): AccessEngine {
  const ctx = useContext(AccessContext)
  return ctx ?? FALLBACK
}

const FALLBACK = createAccessEngine(EMPTY_SNAPSHOT, {})

/** `can`/`levelFor` without the rest of the engine. */
export function usePermissions(): {
  can: AccessEngine['can']
  levelFor: AccessEngine['levelFor']
  isAdmin: boolean
  roles: readonly string[]
} {
  const access = useAccess()
  return { can: access.can, levelFor: access.levelFor, isAdmin: access.isAdmin, roles: access.roles }
}

export function useCan(code: string, required?: AccessLevel): boolean {
  return useAccess().can(code, required)
}

export function useModuleVisible(mod: ModuleAccessShape): boolean {
  return useAccess().moduleVisible(mod)
}

export interface CanProps {
  /** Permission code, e.g. `'users:create'`. */
  do?: string
  /** Any of these is enough. */
  anyOf?: string[]
  /** All of these are required. */
  allOf?: string[]
  level?: AccessLevel
  /** Rendered when the check fails. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Conditional rendering by permission.
 *
 * Worth being blunt about in the docs: this hides a control, it does not
 * protect an action. A hidden button is still a reachable endpoint. Pair every
 * `<Can>` in the UI with an `assertPermission()` on the server side that
 * actually refuses.
 */
export function Can({ do: code, anyOf, allOf, level, fallback = null, children }: CanProps) {
  const access = useAccess()
  const ok =
    (code == null || access.can(code, level)) &&
    (anyOf == null || access.canAny(anyOf, level)) &&
    (allOf == null || access.canAll(allOf, level))
  return <>{ok ? children : fallback}</>
}

/** Renders `children` only for administrators. */
export function IfAdmin({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{useAccess().isAdmin ? children : fallback}</>
}
