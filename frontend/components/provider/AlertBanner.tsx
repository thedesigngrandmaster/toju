'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Eye, Phone } from 'lucide-react'
import { usePatients } from '@/context/PatientsContext'

export default function AlertBanner() {
  const { patients } = usePatients()

  const redPatients = patients.filter((p) => p.riskScore === 'red')
  const latestAlert = redPatients
    .flatMap((p) => p.alerts.filter((a) => !a.resolved).map((a) => ({ ...a, patient: p })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  return (
    <AnimatePresence>
      {latestAlert && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="border border-destructive/20 bg-danger-bg rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {latestAlert.patient.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {latestAlert.message}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/patients/${latestAlert.patient.id}`}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Eye className="size-3" />
                View
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="size-3" />
                Call
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
