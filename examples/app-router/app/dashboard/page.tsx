import { AppShell, AppLauncher, Button } from '@cortejojicoy/admin-kit/ui'

/**
 * The launcher home. Tiles and the dock come from `config.modules`, filtered by
 * the access snapshot the root layout resolved — so this page has no permission
 * logic of its own.
 */
export default function DashboardPage() {
  return (
    <AppShell>
      <AppLauncher
        primaryAction={
          <Button variant="primary" iconKey="plus" className="ak-fab">
            New order
          </Button>
        }
      />
    </AppShell>
  )
}
