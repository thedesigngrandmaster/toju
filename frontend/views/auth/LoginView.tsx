'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShieldCheck, ArrowRight, Copy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { DEMO_CREDENTIALS } from '@/constant/mockPatients'
import { CustomInput, CustomPassword } from '@/components/FormElements'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function LoginView() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back, Doctor.')
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo() {
    setEmail(DEMO_CREDENTIALS.email)
    setPassword(DEMO_CREDENTIALS.password)
    toast('Demo credentials filled in.', { icon: '🔑' })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to home
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        <div className="border rounded-2xl p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="size-10 rounded-lg bg-secondary border flex items-center justify-center mb-3">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              CareBridge Sentinel
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Provider Portal</p>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            <CustomInput
              label="Hospital Email"
              name="email"
              type="email"
              placeholder="doctor@hospital.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <CustomPassword
              label="Password"
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive bg-danger-bg border border-destructive/20 rounded-full px-4 py-2.5 mb-3"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-1 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-xl border bg-secondary/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">
                Demo Access
              </p>
              <button
                type="button"
                onClick={fillDemo}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <Copy className="size-3" />
                Fill in
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 shrink-0">Email</span>
                <span className="text-foreground truncate">{DEMO_CREDENTIALS.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 shrink-0">Pass</span>
                <span className="text-foreground">{DEMO_CREDENTIALS.password}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Lagos University Teaching Hospital
        </p>
      </motion.div>
    </div>
  )
}
