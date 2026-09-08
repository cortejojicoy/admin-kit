/**
 * UI entry — the two panels, the primitives, and the generated CRUD screens.
 *
 * Import the stylesheet once in your app:
 *   import '@cortejojicoy/admin-kit/styles.css'
 */
'use client'

/* panels */
export { AdminShell } from './ui/admin/AdminShell'
export type { AdminShellProps } from './ui/admin/AdminShell'
export { Sidebar, Brand } from './ui/admin/Sidebar'
export { SidebarNav, SidebarItem } from './ui/admin/SidebarNav'

export { AppShell } from './ui/launcher/AppShell'
export type { AppShellProps } from './ui/launcher/AppShell'
export { AppLauncher, LauncherTile, LauncherGreeting } from './ui/launcher/AppLauncher'
export type { AppLauncherProps, LauncherGreetingProps } from './ui/launcher/AppLauncher'
export { Dock, QuickAccessBar, QuickAccessDock } from './ui/launcher/QuickAccess'

export { UserMenu } from './ui/panels/UserMenu'

/* auth */
export { LoginPage, nextDestination } from './ui/auth/LoginPage'
export type { LoginPageProps } from './ui/auth/LoginPage'
export { RequireAuth, RequirePermission } from './ui/guards'

/* generated screens */
export { ResourceTable, listColumns, formatCell, titleize } from './ui/data/ResourceTable'
export type { ResourceTableProps } from './ui/data/ResourceTable'
export { ResourceForm, formFields } from './ui/data/ResourceForm'
export type { ResourceFormProps } from './ui/data/ResourceForm'
export { ResourceShow } from './ui/data/ResourceShow'
export type { ResourceShowProps } from './ui/data/ResourceShow'

/* primitives */
export {
  Button,
  Card,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  SearchInput,
  ErrorMessage,
  EmptyState,
  Skeleton,
  PageHeader,
} from './ui/primitives'
export type { ButtonProps, FieldProps } from './ui/primitives'

/* hooks */
export {
  useDisclosure,
  useMediaQuery,
  useLocalStorage,
  useSlideTransition,
  useDismiss,
} from './ui/hooks'
export type { Disclosure } from './ui/hooks'

export { Icon, IconProvider, useIcon, BUILTIN_ICONS } from './icons/registry'
