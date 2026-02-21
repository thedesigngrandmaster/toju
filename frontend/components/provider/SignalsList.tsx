'use client'

import Link from 'next/link'
import { FileSignature, CheckCircle, Clock } from 'lucide-react'
import { usePatients } from '@/context/PatientsContext'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SignalsList() {
  const { patients } = usePatients()

  const withSignal = patients.filter((p) => p.signal?.approvedAt)
  const pending = patients.filter((p) => !p.signal?.approvedAt)

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold text-muted-foreground">
              Awaiting Extraction ({pending.length})
            </span>
          </div>
          <div className="divide-y">
            {pending.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.id}/signal`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="size-7 rounded-lg bg-warning-bg flex items-center justify-center shrink-0">
                  <Clock className="size-3.5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.diagnosis}</p>
                </div>
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Extract Signal →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {withSignal.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold text-muted-foreground">
              Approved ({withSignal.length})
            </span>
          </div>
          <div className="divide-y">
            {withSignal.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="size-7 rounded-lg bg-success-bg flex items-center justify-center shrink-0">
                  <CheckCircle className="size-3.5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.signal!.diagnosis} · {p.signal!.medications?.length ?? 0} medications · {p.signal!.redFlags?.length ?? 0} red flags
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(p.signal!.approvedAt!)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {patients.length === 0 && (
        <div className="border rounded-xl p-10 text-center">
          <FileSignature className="size-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No patients added yet.</p>
        </div>
      )}
    </div>
  )
}
