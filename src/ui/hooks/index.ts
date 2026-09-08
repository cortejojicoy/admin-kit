'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

export interface Disclosure {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export function useDisclosure(initial = false): Disclosure {
  const [isOpen, setOpen] = useState(initial)
  return useMemo(
    () => ({
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    [isOpen],
  )
}

/**
 * A media query, SSR-safe.
 *
 * `useSyncExternalStore` rather than state-plus-effect: the match is external
 * state React does not own, and subscribing to it directly means no extra
 * commit on mount and no chance of tearing. The server snapshot is `false`,
 * because the viewport is not knowable on the server — so the first paint is
 * the narrow layout and React corrects it during hydration.
 *
 * `matchMedia` is checked separately from `window`: jsdom and some embedded
 * webviews have one without the other.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined
      }
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/* ------------------------- localStorage as a store ------------------------ */

const storageListeners = new Map<string, Set<() => void>>()

/**
 * Parsed values, cached by the raw string they came from.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so a getter that
 * parsed JSON on every call would return a new object each render and loop
 * forever. Caching against the raw text gives a stable identity that still
 * changes exactly when the stored text does.
 */
const storageCache = new Map<string, { raw: string | null; value: unknown }>()

function readStorage<T>(key: string, initial: T): T {
  let raw: string | null
  try {
    raw = typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    // Private mode and blocked site data make the accessor itself throw. A
    // remembered sidebar width is not worth taking the shell down for.
    return initial
  }

  const cached = storageCache.get(key)
  if (cached && cached.raw === raw) return cached.value as T

  let value: T = initial
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = initial
    }
  }
  storageCache.set(key, { raw, value })
  return value
}

function notifyStorage(key: string): void {
  for (const listener of storageListeners.get(key) ?? []) listener()
}

/**
 * State persisted to `localStorage`, subscribed rather than copied.
 *
 * The server snapshot is the supplied initial value, so SSR renders the default
 * and React swaps in the stored value during hydration — no mismatch, and no
 * `setState` in an effect. `storage` events are observed too, so a preference
 * changed in another tab lands here.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const set = storageListeners.get(key) ?? new Set()
    set.add(onChange)
    storageListeners.set(key, set)

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) onChange()
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

    return () => {
      set.delete(onChange)
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }, [key])

  const value = useSyncExternalStore(
    subscribe,
    () => readStorage(key, initial),
    () => initial,
  )

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(readStorage(key, initial)) : next
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        }
      } catch {
        // Unwritable storage: keep the in-memory value so the UI still responds.
      }
      storageCache.set(key, { raw: JSON.stringify(resolved), value: resolved })
      notifyStorage(key)
    },
    [key, initial],
  )

  return [value, set]
}

/**
 * Mount/unmount with an exit animation.
 *
 * `mounted` keeps the element in the tree for `duration` after it is closed;
 * `shown` drives the transition classes. The duration is passed in so the JS
 * timing and the CSS timing come from one number instead of drifting apart.
 */
export function useSlideTransition(
  isOpen: boolean,
  duration: number,
): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(isOpen)
  const [shown, setShown] = useState(isOpen)
  const [wasOpen, setWasOpen] = useState(isOpen)

  // Adjusted during render, not in an effect: mounting has to happen in the
  // same commit the prop flips, or the panel is absent for one frame and the
  // enter animation has nothing to animate. This is the documented way to
  // derive state from a changed prop, and it avoids a wasted commit.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setMounted(true)
  }

  useEffect(() => {
    if (isOpen) {
      // Next frame, so the element paints closed before it animates open.
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    const raf = requestAnimationFrame(() => setShown(false))
    const timer = setTimeout(() => setMounted(false), duration)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [isOpen, duration])

  return { mounted, shown }
}

/** Close on Escape, and on a click outside the element. */
export function useDismiss(
  ref: { current: HTMLElement | null },
  onDismiss: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [ref, onDismiss, active])
}
