'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { CustomInput, CustomPassword } from '@/components/FormElements'
import toast from 'react-hot-toast'

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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="fixed top-4 left-10">
        <Link href="/">
          <Image src="/Image/toju-logo.png" alt="Toju" width={72} height={28} />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        <div className="border rounded-2xl p-6">
          <div className="mb-5">
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Provider Portal
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Sign in to your Toju account</p>
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

        </div>
      </motion.div>
    </div>
  )
}
