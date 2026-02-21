'use client'

import { ReactNode } from 'react'
import { NextUIProvider } from '@nextui-org/react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import { PatientsProvider } from '@/context/PatientsContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NextUIProvider>
      <AuthProvider>
        <PatientsProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '13px',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </PatientsProvider>
      </AuthProvider>
    </NextUIProvider>
  )
}
