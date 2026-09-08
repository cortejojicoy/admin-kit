'use client'

import type { IconRegistry } from '@cortejojicoy/admin-kit/client'

/**
 * Icon overrides, keyed to the `iconKey` strings in `admin.config.ts`.
 *
 * Registered here, on the client, because these are components — the config
 * holds only the string keys, which is what lets it be built on the server and
 * read by the `admin-kit docs` CLI.
 *
 * The kit ships a small built-in set, so this only needs the keys a project
 * wants to look different.
 */
export const icons: IconRegistry = {
  grid: (props) => (
    <svg viewBox="0 0 24 24" fill="none" width="1em" height="1em" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.25" />
    </svg>
  ),
}
