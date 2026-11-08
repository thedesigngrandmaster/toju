import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, WifiOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Button } from '@/components/ui/Button'

export default function LoginView() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const network = useNetworkStatus()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(from, { replace: true })
  }, [isLoading, isAuthenticated, navigate, from])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="fixed left-0 right-0 top-0 safe-top px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src="/Image/toju-logo.png" alt="Toju" width={72} height={28} />
        </Link>
      </div>

      <div className="w-full max-w-sm animate-fade-up">
        <div className="rounded-2xl border p-6">
          <div className="mb-5">
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">Provider portal</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Sign in to your Toju account</p>
          </div>

          {network !== 'online' && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-[11px] leading-relaxed text-warning">
              <WifiOff className="mt-0.5 size-3.5 shrink-0" />
              <p>
                You are offline. Signing in requires internet once. After that, Toju works fully offline on
                this device.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Hospital email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="doctor@hospital.ng"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="username"
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="form-control pr-11"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="mb-3 rounded-lg border border-destructive/20 bg-danger-bg px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={loading} endIcon={<ArrowRight className="size-3.5" />}>
              Sign in
            </Button>
          </form>

          <div className="mt-4 rounded-lg bg-secondary/60 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Demo:</strong> dr.kunle@lagos.hospital.ng · demo2026
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          After first sign-in, your patient list is cached on this device. Install Toju to your home screen
          for reliable offline access.
        </p>
      </div>
    </div>
  )
}
