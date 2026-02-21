'use client'

import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui'

type Props = {
  onApprove: () => void
  loading?: boolean
}

export default function ApproveButton({ onApprove, loading = false }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)

  if (!showConfirm) {
    return (
      <Button
        color="primary"
        className="px-8 py-6 text-white"
        onPress={() => setShowConfirm(true)}
        startContent={<ShieldCheck className="size-4" />}
      >
        Verify & Sync
      </Button>
    )
  }

  return (
    <div className="border rounded-xl shadow-none p-6 space-y-6 w-full">
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Verify & sync this signal?
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This creates the source of truth. The care plan will be sent to
            the patient via WhatsApp and proactive monitoring will begin.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end">
        <Button
          variant="bordered"
          className="px-6 py-5"
          onPress={() => setShowConfirm(false)}
          startContent={<X className="size-4" />}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          className="px-8 py-5 text-white"
          loading={loading}
          onPress={onApprove}
          startContent={!loading ? <ShieldCheck className="size-4" /> : undefined}
        >
          Confirm & Sync
        </Button>
      </div>
    </div>
  )
}
