'use client'

import { useState } from 'react'
import { User, Phone, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import type { PatientLanguage } from '@/types'

const LANGUAGES: { value: PatientLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'pidgin', label: 'Pidgin' },
  { value: 'yoruba', label: 'Yoruba' },
  { value: 'igbo', label: 'Igbo' },
  { value: 'hausa', label: 'Hausa' },
]

export type IntakeData = {
  name: string
  phoneNumber: string
  language: PatientLanguage
}

type Props = {
  onSubmit: (data: IntakeData) => void
  initialData?: Partial<IntakeData>
}

export default function PatientIntakeForm({ onSubmit, initialData }: Props) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initialData?.phoneNumber ?? '')
  const [language, setLanguage] = useState<PatientLanguage>(initialData?.language ?? 'english')

  const isValid = name.trim().length >= 2 && phoneNumber.trim().length >= 10

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSubmit({ name: name.trim(), phoneNumber: phoneNumber.trim(), language })
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-xl shadow-none">
      <div className="p-4 border-b">
        <p className="text-sm font-medium text-muted-foreground">Patient Details</p>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Enter the patient&apos;s core details to begin the CareBridge monitoring loop.
          The AI companion will communicate with the patient in their preferred language.
        </p>

        <div>
          <label className="form-label flex items-center gap-1.5">
            <User className="size-4" />
            Patient Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mama Okoro"
            className="form-control"
            autoFocus
          />
        </div>

        <div>
          <label className="form-label flex items-center gap-1.5">
            <Phone className="size-4" />
            WhatsApp Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. +2348012345678"
            className="form-control"
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Must be a WhatsApp-enabled number
          </p>
        </div>

        <div>
          <label className="form-label flex items-center gap-1.5">
            <Globe className="size-4" />
            Preferred Language
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => setLanguage(lang.value)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                  language === lang.value
                    ? 'bg-primary text-white border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            The AI health companion will speak to the patient in this language
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            color="primary"
            className="px-6 text-white"
            isDisabled={!isValid}
          >
            Continue to Data Drop
          </Button>
        </div>
      </div>
    </form>
  )
}
