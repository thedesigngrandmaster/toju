import type { Metadata } from 'next'
import LoginView from '@/views/auth/LoginView'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage() {
  return <LoginView />
}
