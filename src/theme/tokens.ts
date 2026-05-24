/**
 * Default theme tokens, exposed as CSS custom properties under `[data-admin-kit]`.
 * Consumers can override any token via `config.theme.tokens`.
 */
export const DEFAULT_TOKENS = {
  '--admin-color-bg': '#fafafa',
  '--admin-color-surface': '#ffffff',
  '--admin-color-border': '#e5e5e5',
  '--admin-color-text': '#171717',
  '--admin-color-text-muted': '#737373',
  '--admin-color-primary': '#171717',
  '--admin-color-primary-fg': '#ffffff',
  '--admin-color-accent': '#3b82f6',
  '--admin-radius': '0.5rem',
  '--admin-sidebar-width': '16rem',
  '--admin-sidebar-collapsed-width': '4rem',
  '--admin-topbar-height': '3.5rem',
} as const

export type ThemeTokens = Partial<Record<keyof typeof DEFAULT_TOKENS | string, string>>

export function tokensToStyle(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tokens)) {
    if (v != null) out[k] = v
  }
  return out
}
