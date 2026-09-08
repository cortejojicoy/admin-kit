/**
 * Design tokens, as CSS custom properties.
 *
 * The stylesheet (`@cortejojicoy/admin-kit/styles.css`) is written entirely
 * against these, so a consumer restyles the whole kit by overriding a handful
 * of values through `config.theme.tokens` — no Tailwind, no build step, no
 * class-name surgery.
 *
 * v0.1.x shipped a token set that no component referenced *and* Tailwind
 * utility classes that never reached a Tailwind build, so nothing was styled at
 * all. One system now, and it is this one.
 */
export const DEFAULT_TOKENS = {
  /* surfaces */
  '--ak-canvas': '#f6f7f9',
  '--ak-surface': '#ffffff',
  '--ak-surface-muted': '#f1f3f5',
  '--ak-border': '#e3e6ea',
  '--ak-border-strong': '#cfd4da',

  /* text */
  '--ak-text': '#16191d',
  '--ak-text-muted': '#697280',
  '--ak-text-inverted': '#ffffff',

  /* accents */
  '--ak-primary': '#1f6feb',
  '--ak-primary-hover': '#1a5fd0',
  '--ak-primary-fg': '#ffffff',
  '--ak-primary-soft': '#e8f0fe',
  '--ak-danger': '#d1242f',
  '--ak-danger-soft': '#fdeceb',
  '--ak-success': '#1a7f37',
  '--ak-success-soft': '#e8f6ec',
  '--ak-warning': '#9a6700',
  '--ak-warning-soft': '#fdf6e3',
  '--ak-focus': '#1f6feb',

  /* shape */
  '--ak-radius': '0.5rem',
  '--ak-radius-lg': '0.875rem',
  '--ak-radius-sm': '0.375rem',
  '--ak-shadow': '0 1px 2px rgba(16, 24, 40, 0.06)',
  '--ak-shadow-lg': '0 12px 32px rgba(16, 24, 40, 0.14)',

  /* metrics */
  '--ak-sidebar-width': '16rem',
  '--ak-sidebar-collapsed-width': '4rem',
  '--ak-topbar-height': '3.75rem',
  '--ak-content-max': '80rem',
  '--ak-gap': '1.25rem',
  '--ak-font': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  '--ak-font-mono': "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

/** Dark-mode overrides, applied under `[data-ak-theme='dark']`. */
export const DARK_TOKENS: Record<string, string> = {
  '--ak-canvas': '#0d1117',
  '--ak-surface': '#161b22',
  '--ak-surface-muted': '#1c2128',
  '--ak-border': '#2a313a',
  '--ak-border-strong': '#3a424d',
  '--ak-text': '#e6edf3',
  '--ak-text-muted': '#9198a1',
  '--ak-primary': '#4493f8',
  '--ak-primary-hover': '#58a6ff',
  '--ak-primary-soft': '#132b47',
  '--ak-danger': '#f85149',
  '--ak-danger-soft': '#3d1a1a',
  '--ak-success': '#3fb950',
  '--ak-success-soft': '#132b1c',
  '--ak-warning': '#d29922',
  '--ak-warning-soft': '#3a2c10',
  '--ak-shadow': '0 1px 2px rgba(0, 0, 0, 0.4)',
  '--ak-shadow-lg': '0 12px 32px rgba(0, 0, 0, 0.5)',
}

export type ThemeTokens = Partial<Record<keyof typeof DEFAULT_TOKENS | string, string>>

export function tokensToStyle(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) {
    if (value != null) out[key] = value
  }
  return out
}

/**
 * Derive the accent ramp from one colour, so `theme.primaryColor` alone is a
 * usable amount of theming.
 */
export function tokensFromPrimary(primary: string): ThemeTokens {
  return {
    '--ak-primary': primary,
    '--ak-primary-hover': primary,
    '--ak-focus': primary,
  }
}
