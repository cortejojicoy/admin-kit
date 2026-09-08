import { redirect } from 'next/navigation'
import { adminConfig } from '@/admin.config'

export default function Home() {
  redirect(adminConfig.panels?.app?.home ?? '/dashboard')
}
