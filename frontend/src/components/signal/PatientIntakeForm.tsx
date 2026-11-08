import { useState, type FormEvent } from 'react'
import { Globe, Phone, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { PatientLanguage } from '@/types'

const LANGUAGES: { value: PatientLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'pidgin', label: 'Pidgin' },
  { value: 'yoruba', label: 'Yoruba' },
  { value: 'igbo', label: 'Igbo' },
  { value: 'hausa', label: 'Hausa' },
]

export interface IntakeData {
  name: string
  phoneNumber: string
  language: PatientLanguage
}

export function PatientIntakeForm({
  onSubmit,
  initialData,
  loading,
}: {
  onSubmit: (data: IntakeData) => void
  initialData?: Partial<IntakeData>
  loading?: boolean
}) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initialData?.phoneNumber ?? '')
  const [language, setLanguage] = useState<PatientLanguage>(initialData?.language ?? 'english')

  const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '')
  const validPhone = /^\+\d{10,15}$/.test(normalizedPhone)
  const valid = name.trim().length >= 2 && validPhone

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    onSubmit({ name: name.trim(), phoneNumber: normalizedPhone, language })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border">
      <div className="border-b p-4">
        <p className="text-sm font-medium text-muted-foreground">Patient details</p>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enter the patient&apos;s core details to begin the Toju monitoring loop. The AI companion will
          communicate with the patient in their preferred language.
        </p>

        <div>
          <label className="form-label flex items-center gap-1.5" htmlFor="patient-name">
            <User className="size-4" />
            Patient name
          </label>
          <input
            id="patient-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Mama Okoro"
            className="form-control"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div>
          <label className="form-label flex items-center gap-1.5" htmlFor="patient-phone">
            <Phone className="size-4" />
            WhatsApp phone number
          </label>
          <input
            id="patient-phone"
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+2348012345678"
            className={cn('form-control', phoneNumber && !validPhone && 'is-invalid')}
            autoComplete="off"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            International format: + followed by 10–15 digits. Must be WhatsApp-enabled.
          </p>
        </div>

        <div>
          <label className="form-label flex items-center gap-1.5">
            <Globe className="size-4" />
            Preferred language
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setLanguage(item.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  language === item.value
                    ? 'border-primary bg-primary text-white'
                    : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Gemini replies in this language for WhatsApp check-ins and triage.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!valid} loading={loading}>
            Continue to data drop
          </Button>
        </div>
      </div>
    </form>
  )
}
