'use client'

import { SlidersHorizontal, MessageCircle, Video } from 'lucide-react'
import { Button } from '@/components/ui'
import toast from 'react-hot-toast'

export default function InterventionBar({ patientName }: { patientName: string }) {
  function handleAdjust() {
    toast.success(`Monitoring frequency updated for ${patientName}`)
  }

  function handleMessage() {
    toast.success(`Direct message sent to ${patientName}`)
  }

  function handleTelehealth() {
    toast.success(`Telehealth session initiated with ${patientName}`)
  }

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b">
        <p className="text-sm font-medium text-muted-foreground">Interventions</p>
      </div>
      <div className="p-4 flex flex-wrap gap-3">
        <Button
          variant="bordered"
          className="px-4"
          onPress={handleAdjust}
          startContent={<SlidersHorizontal className="size-4" />}
        >
          Adjust Frequency
        </Button>
        <Button
          variant="bordered"
          className="px-4"
          onPress={handleMessage}
          startContent={<MessageCircle className="size-4" />}
        >
          Send Message
        </Button>
        <Button
          color="primary"
          className="px-4 text-white"
          onPress={handleTelehealth}
          startContent={<Video className="size-4" />}
        >
          Launch Telehealth
        </Button>
      </div>
    </div>
  )
}
