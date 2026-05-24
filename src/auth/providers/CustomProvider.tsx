import type { AuthProvider } from '../types'

/**
 * Pass-through factory for consumers supplying their own AuthProvider.
 * Exists so `config.auth.provider === 'custom'` resolution can stay symmetric
 * with `'jwt'` and `'oauth'`.
 */
export function createCustomProvider(provider: AuthProvider): AuthProvider {
  if (!provider) throw new Error('config.auth.custom is required when provider is "custom"')
  return provider
}
