'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Bell,
  FileSignature,
  ShieldCheck,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { usePatients } from '@/context/PatientsContext'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/patients', label: 'Patients', icon: Users },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { href: '/dashboard/signals', label: 'Signals', icon: FileSignature },
]

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const { doctor, logout } = useAuth()
  const { patients } = usePatients()

  const unresolvedAlerts = patients
    .flatMap((p) => p.alerts)
    .filter((a) => !a.resolved).length

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 border-r bg-background flex flex-col z-40 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <Link
          href="/dashboard"
          className={cn('flex items-center gap-2 min-w-0', collapsed && 'justify-center')}
        >
          <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="size-3.5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground leading-none">
                CareBridge
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Sentinel
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="p-3 flex justify-center">
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg text-xs font-medium transition-colors',
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && (
                <>
                  {item.label}
                  {item.label === 'Alerts' && unresolvedAlerts > 0 && (
                    <span className="ml-auto text-[10px] font-semibold bg-danger-bg text-destructive px-1.5 py-0.5 rounded-full leading-none">
                      {unresolvedAlerts}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.label === 'Alerts' && unresolvedAlerts > 0 && (
                <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive" />
              )}
            </Link>
          )
        })}

        <div className={cn(collapsed ? '' : 'pt-2')}>
          <Link
            href="/dashboard/patients/new"
            title={collapsed ? 'Add Patient' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg text-xs font-medium text-primary hover:bg-muted/50 transition-colors',
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
            )}
          >
            <Plus className="size-4 shrink-0" />
            {!collapsed && 'Add Patient'}
          </Link>
        </div>
      </nav>

      <div className={cn('border-t', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-foreground truncate">
              {doctor?.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {doctor?.hospital}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'flex items-center gap-2.5 w-full rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
            collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
          )}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
