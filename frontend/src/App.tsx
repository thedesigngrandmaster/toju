import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui/Spinner'

const LandingView = lazy(() => import('@/views/LandingView'))
const LoginView = lazy(() => import('@/views/LoginView'))
const DashboardLayout = lazy(() => import('@/components/layout/DashboardLayout'))
const DashboardView = lazy(() => import('@/views/DashboardView'))
const PatientsView = lazy(() => import('@/views/PatientsView'))
const PatientDetailView = lazy(() => import('@/views/PatientDetailView'))
const SignalView = lazy(() => import('@/views/SignalView'))
const AlertsView = lazy(() => import('@/views/AlertsView'))
const SignalsView = lazy(() => import('@/views/SignalsView'))
const WhatsAppView = lazy(() => import('@/views/WhatsAppView'))
const AuditView = lazy(() => import('@/views/AuditView'))
const SettingsView = lazy(() => import('@/views/SettingsView'))
const NotFoundView = lazy(() => import('@/views/NotFoundView'))

function FullPageLoader() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-5 text-primary" />
        <p className="text-xs text-muted-foreground">Loading Toju…</p>
      </div>
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/auth/login" element={<LoginView />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardLayout />
            </Protected>
          }
        >
          <Route index element={<DashboardView />} />
          <Route path="patients" element={<PatientsView />} />
          <Route path="patients/new" element={<SignalView />} />
          <Route path="patients/:patientId" element={<PatientDetailView />} />
          <Route path="patients/:patientId/signal" element={<SignalView />} />
          <Route path="alerts" element={<AlertsView />} />
          <Route path="signals" element={<SignalsView />} />
          <Route path="whatsapp" element={<WhatsAppView />} />
          <Route path="audit" element={<AuditView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
        <Route path="*" element={<NotFoundView />} />
      </Routes>
    </Suspense>
  )
}
