import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Sora } from 'next/font/google'
import './globals.css'
import Providers from '@/app/providers'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    template: '%s | Toju',
    default: 'Toju — AI Post-Discharge Monitoring',
  },
  description:
    'Toju turns messy discharge notes into proactive, AI-powered patient monitoring — closing the loop between hospital and home.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${sora.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
