import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  FileSignature,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { SyncBadge } from '@/components/ui/SyncBadge'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { toast } from '@/lib/toast'

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/patients', label: 'Patients', icon: Users },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { to: '/dashboard/signals', label: 'Signals', icon: FileSignature },
  { to: '/dashboard/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { to: '/dashboard/audit', label: 'Audit trail', icon: ScrollText },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const mobileNav = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/dashboard/patients', label: 'Patients', icon: Users },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { to: '/dashboard/signals', label: 'Signals', icon: FileSignature },
  { to: '/dashboard/settings', label: 'More', icon: Settings },
]

function useUnresolvedAlertCount() {
  return useLiveQuery(async () => {
    const alerts = await db.alerts.toArray()
    return alerts.filter((alert) => !alert.resolved).length
  }, [], 0)
}

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('toju_sidebar_collapsed') === '1')
  const { doctor, logout, sessionExpired } = useAuth()
  const { syncNow, syncing, lastError } = useSync()
  const network = useNetworkStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const unresolved = useUnresolvedAlertCount()

  useEffect(() => {
    localStorage.setItem('toju_sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (sessionExpired) {
      toast.error('Session expired', 'Sign in again when you have internet to resume syncing. Your local data is safe.')
    }
  }, [sessionExpired])

  async function handleSync() {
    if (network !== 'online') {
      toast.info('Offline', 'Changes are saved locally and will sync automatically when you reconnect.')
      return
    }
    await syncNow()
    if (lastError) toast.error('Sync needs attention', lastError)
    else toast.success('Sync complete')
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-background transition-[width] duration-200 lg:flex',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <div className={cn('flex items-center border-b p-3', collapsed ? 'justify-center' : 'justify-between')}>
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2">
            <img
              src={collapsed ? '/icons/icon-192.png' : '/Image/toju-logo.png'}
              alt="Toju"
              width={collapsed ? 28 : 72}
              height={28}
              className="shrink-0 rounded-md"
            />
          </NavLink>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center p-3">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg text-xs font-medium transition-colors',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {item.to === '/dashboard/alerts' && unresolved > 0 && !collapsed && (
                  <span className="ml-auto rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive">
                    {unresolved}
                  </span>
                )}
                {item.to === '/dashboard/alerts' && unresolved > 0 && collapsed && (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive" />
                )}
              </NavLink>
            )
          })}

          <div className={collapsed ? '' : 'pt-2'}>
            <NavLink
              to="/dashboard/patients/new"
              title={collapsed ? 'Add Patient' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg text-xs font-medium text-primary transition-colors hover:bg-muted/50',
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
              )}
            >
              <Plus className="size-4 shrink-0" />
              {!collapsed && 'Add Patient'}
            </NavLink>
          </div>
        </nav>

        <div className={cn('border-t', collapsed ? 'p-2' : 'p-3')}>
          {!collapsed && (
            <div className="mb-2 px-3 py-2">
              <p className="truncate text-xs font-medium text-foreground">{doctor?.name}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{doctor?.hospital}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
            )}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className={cn('min-h-dvh transition-[margin-left] duration-200', collapsed ? 'lg:ml-14' : 'lg:ml-56')}>
        <header className="safe-top sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 lg:px-6">
            <NavLink to="/dashboard" className="flex items-center gap-2 lg:hidden">
              <img src="/icons/icon-192.png" alt="Toju" width={26} height={26} className="rounded-md" />
              <span className="font-display text-sm font-semibold tracking-tight">Toju</span>
            </NavLink>

            <div className="hidden items-center gap-2 lg:flex">
              <SyncBadge showTime />
              {unresolved > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/alerts')}
                  className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-medium text-destructive"
                >
                  <Bell className="size-3" />
                  {unresolved} active alert{unresolved === 1 ? '' : 's'}
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="lg:hidden">
                <SyncBadge />
              </div>
              <InstallPrompt compact />
              <button
                type="button"
                onClick={() => void handleSync()}
                aria-label="Sync now"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RefreshCw className={cn('size-4', syncing && 'animate-spin')} />
              </button>
              <NavLink
                to="/dashboard/settings"
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground"
                aria-label="Settings"
              >
                {doctor?.name
                  ?.split(' ')
                  .filter((part) => !part.includes('.'))
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('') || 'DR'}
              </NavLink>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-24 pt-3 lg:px-6 lg:pb-8">
          <OfflineBanner className="mb-3" />
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {mobileNav.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
                {item.to === '/dashboard/alerts' && unresolved > 0 && (
                  <span className="absolute right-[22%] top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold leading-4 text-white">
                    {unresolved > 9 ? '9+' : unresolved}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
