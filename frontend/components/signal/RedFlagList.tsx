'use client'

import { useState } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  flags: string[]
  onChange: (flags: string[]) => void
  readOnly?: boolean
}

export default function RedFlagList({ flags, onChange, readOnly = false }: Props) {
  const [draft, setDraft] = useState('')

  function addFlag() {
    const trimmed = draft.trim()
    if (!trimmed || flags.includes(trimmed)) return
    onChange([...flags, trimmed])
    setDraft('')
  }

  function removeFlag(index: number) {
    onChange(flags.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFlag()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <p className="text-sm font-medium text-muted-foreground">
          Red Flags to Monitor
        </p>
        <span className="text-xs text-muted-foreground">
          ({flags.length})
        </span>
      </div>

      <div className="space-y-1.5">
        {flags.map((flag, i) => (
          <div
            key={i}
            className="flex items-start gap-2 bg-danger-bg/50 border border-destructive/10 rounded-lg px-4 py-3"
          >
            <span className="size-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
            <p className="text-xs text-foreground flex-1 leading-relaxed">
              {flag}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeFlag(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a red flag symptom…"
            className={cn(
              'flex-1 border rounded-full px-4 py-1.5 text-xs text-foreground bg-background',
              'outline-none transition-all',
              'placeholder:text-muted-foreground'
            )}
          />
          <button
            type="button"
            onClick={addFlag}
            disabled={!draft.trim()}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground transition-colors p-1"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
