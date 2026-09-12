# Theming

One stylesheet, driven entirely by CSS custom properties. No Tailwind, no
preset, no content globs — and nothing to configure in your build.

```tsx
// once, in the root layout
import '@cortejojicoy/admin-kit/styles.css'
```

If you would rather style everything yourself, skip that import. Every component
takes a `className`, so a design system can restyle the kit rather than
reimplement it.

## The quickest useful change

```ts
theme: { primaryColor: '#1f6feb' }
```

`tokensFromPrimary()` derives the accent ramp from that one colour, so a single
line is a usable amount of theming.

## Mode

```ts
theme: { mode: 'system' }   // 'light' | 'dark' | 'system' — default 'system'
```

Dark values are applied under `[data-ak-theme='dark']`, which `<ThemeProvider>`
sets. In `system` mode it follows `prefers-color-scheme` and keeps following it;
an explicit choice persists.

```tsx
'use client'
import { useTheme } from '@cortejojicoy/admin-kit/client'

function ThemeButton() {
  const { mode, resolved, setMode } = useTheme()
  return <button onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}>Theme</button>
}
```

## Tokens

Override any of these through `theme.tokens`:

```ts
theme: {
  tokens: {
    '--ak-radius': '0.75rem',
    '--ak-sidebar-width': '18rem',
    '--ak-font': '"Inter", system-ui, sans-serif',
  },
}
```

### Surfaces

| Token | Default |
| --- | --- |
| `--ak-canvas` | `#f6f7f9` |
| `--ak-surface` | `#ffffff` |
| `--ak-surface-muted` | `#f1f3f5` |
| `--ak-border` | `#e3e6ea` |
| `--ak-border-strong` | `#cfd4da` |

### Text

| Token | Default |
| --- | --- |
| `--ak-text` | `#16191d` |
| `--ak-text-muted` | `#697280` |
| `--ak-text-inverted` | `#ffffff` |

### Accents

| Token | Default |
| --- | --- |
| `--ak-primary` | `#1f6feb` |
| `--ak-primary-hover` | `#1a5fd0` |
| `--ak-primary-fg` | `#ffffff` |
| `--ak-primary-soft` | `#e8f0fe` |
| `--ak-danger` / `--ak-danger-soft` | `#d1242f` / `#fdeceb` |
| `--ak-success` / `--ak-success-soft` | `#1a7f37` / `#e8f6ec` |
| `--ak-warning` / `--ak-warning-soft` | `#9a6700` / `#fdf6e3` |
| `--ak-focus` | `#1f6feb` |

### Shape

| Token | Default |
| --- | --- |
| `--ak-radius` | `0.5rem` |
| `--ak-radius-lg` | `0.875rem` |
| `--ak-radius-sm` | `0.375rem` |
| `--ak-shadow` | `0 1px 2px rgba(16, 24, 40, 0.06)` |
| `--ak-shadow-lg` | `0 12px 32px rgba(16, 24, 40, 0.14)` |

### Metrics

| Token | Default |
| --- | --- |
| `--ak-sidebar-width` | `16rem` |
| `--ak-sidebar-collapsed-width` | `4rem` |
| `--ak-topbar-height` | `3.75rem` |
| `--ak-content-max` | `80rem` |
| `--ak-gap` | `1.25rem` |
| `--ak-font` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` |
| `--ak-font-mono` | `ui-monospace, SFMono-Regular, Menlo, monospace` |

`DEFAULT_TOKENS` and `DARK_TOKENS` are exported if you want to read or extend
them in code, along with `tokensToStyle()` and `tokensFromPrimary()`.

## Scoping

```ts
theme: { className: 'axiomkit' }
```

The class lands on the shell root, which gives you a selector to hang your own
overrides on without fighting specificity:

```css
.axiomkit .ak-sidebar { border-right: none; }
```

Tokens can also be set from your own CSS, which is often simpler than routing
them through config — they are ordinary custom properties:

```css
:root {
  --ak-primary: #7c3aed;
  --ak-radius: 0.75rem;
}
[data-ak-theme='dark'] {
  --ak-canvas: #0b0e14;
}
```

## Component-level styling

Every component accepts `className`, and the primitives are plain elements
underneath:

```tsx
<ResourceTable resource="users" className="my-table" />
<Button className="my-button">Save</Button>
```

The primitives — `Button`, `Card`, `Badge`, `Field`, `Input`, `Textarea`,
`Select`, `SearchInput`, `ErrorMessage`, `EmptyState`, `Skeleton`, `PageHeader`
— exist so generated screens have something consistent to render. They are not
a design system, and replacing them with yours is expected: the hooks and the
access engine are the parts worth keeping.

`cn()` is exported for conditional class names, if you want the same helper the
kit uses.

## Layout

Some of what looks like theming is layout config:

```ts
layout: {
  sidebarPosition: 'left',
  sidebarCollapsible: true,
  sidebarDefaultCollapsed: false,
  topbar: { visible: true },
  footer: { visible: true, text: '© Axiomkit' },
  maxWidth: '80rem',
}
```

See [Configuration](./configuration.md).
