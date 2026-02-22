'use client'

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { FileText, Upload, X, ClipboardPaste, Sparkles, BrainCircuit } from 'lucide-react'
import { Spinner } from '@nextui-org/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { DEMO_EMR_NOTE } from '@/constant/demoNotes'

const ACCEPTED_EXT = ['.txt', '.pdf', '.doc', '.docx']

type Props = {
  onSubmit: (notes: string) => void
  loading?: boolean
}

export default function NotesUploadArea({ onSubmit, loading = false }: Props) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setText(content)
    }
    reader.readAsText(file)
  }, [])

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  function handleClear() {
    setText('')
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleUseDemoNotes() {
    setText(DEMO_EMR_NOTE)
    setFileName(null)
    setMode('paste')
  }

  const hasContent = text.trim().length > 0

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">Signal Ingestor</p>
        <button
          type="button"
          onClick={handleUseDemoNotes}
          className="ml-auto text-xs font-medium text-primary hover:underline underline-offset-2 flex items-center gap-1"
        >
          <Sparkles className="size-4" />
          Use Demo Notes
        </button>
      </div>
      <div className="p-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-6 py-10 border border-dashed rounded-xl">
            <div className="relative size-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <BrainCircuit className="size-5 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold tracking-tight text-foreground">Analyzing clinical notes</p>
              <p className="text-xs text-muted-foreground">Gemini AI is extracting the clinical signal</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                  mode === 'upload'
                    ? 'bg-primary text-white border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground'
                )}
              >
                <Upload className="size-4 inline-block mr-1.5 -mt-px" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                  mode === 'paste'
                    ? 'bg-primary text-white border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground'
                )}
              >
                <ClipboardPaste className="size-4 inline-block mr-1.5 -mt-px" />
                Paste Text
              </button>
            </div>

            {mode === 'upload' && !hasContent && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 min-h-[180px]',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXT.join(',')}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="size-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">
                    Drop discharge notes here
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports .txt, .pdf, .doc, .docx — or click to browse
                  </p>
                </div>
              </div>
            )}

            {mode === 'upload' && hasContent && fileName && (
              <div className="border rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {text.length.toLocaleString()} characters loaded
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 bg-secondary/50 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {text.slice(0, 800)}
                    {text.length > 800 && '…'}
                  </pre>
                </div>
              </div>
            )}

            {mode === 'paste' && (
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    setFileName(null)
                  }}
                  placeholder="Paste the raw EMR / discharge notes here…"
                  rows={10}
                  className="w-full border rounded-xl p-4 text-xs text-foreground bg-background resize-none outline-none transition-all placeholder:text-muted-foreground leading-relaxed"
                />
                {hasContent && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {hasContent
              ? `${text.length.toLocaleString()} characters ready`
              : 'Upload or paste discharge notes to begin'}
          </p>
          <Button
            color="primary"
            className="px-6 text-white"
            isDisabled={!hasContent || loading}
            startContent={loading ? <Spinner size="sm" color="current" /> : undefined}
            onPress={() => onSubmit(text)}
          >
            {loading ? 'Analyzing…' : 'Generate Signal'}
          </Button>
        </div>
      </div>
    </div>
  )
}
