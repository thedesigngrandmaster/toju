import type { ReactNode } from 'react'
import DashboardLayout from '@/components/provider/DashboardLayout'

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
