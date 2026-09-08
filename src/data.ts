/** Data entry — resources, the data provider, and the CRUD hooks. */
'use client'

export {
  useList,
  useOne,
  useCreate,
  useUpdate,
  useDelete,
  useAction,
  useResource,
} from './data/hooks'
export type { UseListOptions, UseListResult, UseOneResult, MutationResult } from './data/hooks'

export { DataProviderContext, DataStoreProvider, useDataProvider, useDataStore } from './data/context'
export { createRestDataProvider, buildListQuery, fillPath, defaultListMapper } from './data/restProvider'
export { DataStore, cacheKey, resourcePrefix, stableStringify } from './data/store'
export { createHttpClient, HttpError } from './http/client'

export type {
  DataProvider,
  ResourceDescriptor,
  ResourceEndpoints,
  ResourceMappers,
  EndpointDescriptor,
  FieldDescriptor,
  ListParams,
  ListResult,
  NormalizedError,
  QueryNaming,
  CrudOperation,
} from './data/types'

/** Identity helper giving full type-checking on a resource definition. */
export function defineResource<T extends { name: string }>(resource: T): T {
  return resource
}
