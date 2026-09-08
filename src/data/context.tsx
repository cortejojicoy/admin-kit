'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { DataStore } from './store'
import type { DataProvider } from './types'

export const DataProviderContext = createContext<DataProvider | null>(null)

export function useDataProvider(): DataProvider {
  const provider = useContext(DataProviderContext)
  if (!provider) {
    throw new Error(
      'No data provider found. Mount <AdminProvider> (it builds one from ' +
        'config.resources) or pass `dataProvider` explicitly.',
    )
  }
  return provider
}

const StoreContext = createContext<DataStore | null>(null)

export function DataStoreProvider({
  store,
  staleTime,
  children,
}: {
  store?: DataStore
  staleTime?: number
  children: ReactNode
}) {
  // Created once per mount. See the note in AuthContextProvider on why this is
  // a state initializer and not a ref.
  const [instance] = useState(() => store ?? new DataStore({ staleTime }))
  return <StoreContext.Provider value={instance}>{children}</StoreContext.Provider>
}

/**
 * The query cache.
 *
 * Falls back to a module-level store when no provider is mounted, so the hooks
 * work in a bare test render. In an app the store comes from the provider, so
 * two mounted apps (or two tests) never share cache entries.
 */
const fallbackStore = new DataStore()

export function useDataStore(): DataStore {
  return useContext(StoreContext) ?? fallbackStore
}
