import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ClipboardPaste, FileText, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DEMO_EMR_NOTE } from '@/constants/demoNotes'
import { cn } from '@/lib/utils'

export function NotesUploadArea({
  onSubmit,
  loading,
  queued,
}: {
  onSubmit: (notes: string) => void
  loading?: boolean
  queued?: boolean
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [mode, setMode] = useState<'upload' | 'paste'>('paste')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasContent = text.trim().length > 0

  function readFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => setText(String(event.target?.result ?? ''))
    reader.readAsText(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) readFile(file)
  }

  if (queued) {
    return (
      <div className="rounded-xl border border-info/20 bg-info-bg p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-info/10">
          <Sparkles className="size-5 text-info" />
        </div>
        <p className="text-sm font-semibold text-foreground">Queued for AI analysis</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Your discharge notes are saved on this device. Gemini will extract the clinical signal automatically as
          soon as you reconnect — even if you close the app.
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">You can continue reviewing other patients.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b p-4">
        <p className="text-sm font-medium text-muted-foreground">Signal ingestor</p>
        <button
          type="button"
          onClick={() => {
            setText(DEMO_EMR_NOTE)
            setFileName(null)
            setMode('paste')
          }}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          <Sparkles className="size-3.5" />
          Use demo notes
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'upload' ? 'border-primary bg-primary text-white' : 'text-muted-foreground',
            )}
          >
            <Upload className="mr-1.5 inline-block size-3.5 -translate-y-px" />
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'paste' ? 'border-primary bg-primary text-white' : 'text-muted-foreground',
            )}
          >
            <ClipboardPaste className="mr-1.5 inline-block size-3.5 -translate-y-px" />
            Paste text
          </button>
        </div>

        {mode === 'upload' && !hasContent && (
          <button
            type="button"
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-4 text-center transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.csv,text/plain"
              onChange={onFileChange}
              className="hidden"
            />
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Drop discharge notes here</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Text files are supported. PDFs should be pasted as text.
              </p>
            </div>
          </button>
        )}

        {mode === 'upload' && hasContent && fileName && (
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {text.length.toLocaleString()} characters loaded
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setText('')
                  setFileName(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove file"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {mode === 'paste' && (
          <div className="relative">
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setFileName(null)
              }}
              rows={10}
              placeholder="Paste the raw EMR / discharge notes here…"
              className="w-full resize-none rounded-xl border bg-background p-4 text-xs leading-relaxed outline-none focus:border-primary/40"
            />
            {hasContent && (
              <button
                type="button"
                onClick={() => setText('')}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                aria-label="Clear notes"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            {hasContent ? `${text.length.toLocaleString()} characters ready` : 'Notes stay on this device until synced'}
          </p>
          <Button
            onClick={() => onSubmit(text)}
            disabled={!hasContent || loading}
            loading={loading}
            startIcon={!loading ? <Sparkles className="size-3.5" /> : undefined}
          >
            {loading ? 'Analyzing…' : 'Generate signal'}
          </Button>
        </div>
      </div>
    </div>
  )
}
