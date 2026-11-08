import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { usePatients, usePendingOutbox } from '@/hooks/useLocalData'
import { useSync } from '@/context/SyncContext'
import { Button } from '@/components/ui/Button'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { queueWhatsAppMessageLocal } from '@/lib/repository'
import { toast } from '@/lib/toast'
import type { OutboundMessage, WhatsAppStatus } from '@/types'

const POLL_MS = 15_000

const messageTone: Record<OutboundMessage['status'], { label: string; cls: string }> = {
  pending: { label: 'Queued', cls: 'bg-warning-bg text-warning' },
  sending: { label: 'Sending', cls: 'bg-info-bg text-info' },
  sent: { label: 'Sent', cls: 'bg-success-bg text-success' },
  failed: { label: 'Failed', cls: 'bg-danger-bg text-destructive' },
}

function qrSource(qr: string | null | undefined): string | null {
  if (!qr) return null
  if (qr.startsWith('data:')) return qr
  if (qr.startsWith('http')) return qr
  return `data:image/png;base64,${qr}`
}

export default function WhatsAppView() {
  const online = useIsOnline()
  const { patients } = usePatients()
  const { ops, pending: pendingClinical } = usePendingOutbox()
  const { syncNow, syncing } = useSync()

  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [messages, setMessages] = useState<OutboundMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const localQueue = useMemo(
    () => ops.filter((op) => op.entityType === 'whatsapp'),
    [ops],
  )

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextStatus, outbox] = await Promise.all([api.whatsapp.status(), api.whatsapp.outbox()])
      setStatus(nextStatus)
      setMessages(outbox.messages)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the WhatsApp service')
    } finally {
      setLoading(false)
    }
  }, [online])

  useEffect(() => {
    void load()
    if (!online) return
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load, online])

  async function retry(messageId: string) {
    setRetrying(messageId)
    try {
      await api.whatsapp.retry(messageId)
      toast.success('Message re-queued', 'The server will retry delivery with backoff.')
      await load()
    } catch (err) {
      toast.error('Could not retry message', err instanceof Error ? err.message : undefined)
    } finally {
      setRetrying(null)
    }
  }

  async function queueMessage() {
    if (!phoneNumber.trim() || !body.trim()) return
    setSending(true)
    try {
      await queueWhatsAppMessageLocal({
        phoneNumber: phoneNumber.trim(),
        body: body.trim(),
      })
      setBody('')
      toast.success(
        'Message queued',
        online
          ? 'Saved to the offline outbox and sending through the durable WhatsApp queue.'
          : 'Saved locally. It will be sent when you reconnect.',
      )
      if (online) await syncNow()
      await load()
    } catch (err) {
      toast.error('Could not queue message', err instanceof Error ? err.message : undefined)
    } finally {
      setSending(false)
    }
  }

  function prefill(phone: string) {
    setPhoneNumber(phone)
  }

  const qr = qrSource(status?.qr)
  const connected = Boolean(status?.ready)
  const pendingMessages = status?.pendingMessages ?? 0
  const failedMessages = status?.failedMessages ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">WhatsApp</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Messaging bridge · outbound messages are queued durably on the server
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium',
              connected ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning',
            )}
          >
            <span className={cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-warning')} />
            {connected ? 'Connected' : status?.state ?? 'Unknown'}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={!online || loading}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            aria-label="Refresh WhatsApp status"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {!online && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-bg px-3 py-2.5 text-[11px] text-warning">
          <CloudOff className="mt-0.5 size-3.5 shrink-0" />
          <p className="leading-relaxed">
            You are offline. Incoming patient messages and RED alerts are fetched and persisted by the
            server; manual messages are saved in this device&apos;s outbox and sent when you reconnect.
          </p>
        </div>
      )}

      {error && online && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-danger-bg px-3 py-2.5 text-[11px] text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Connection</p>
          <p className={cn('mt-1 text-sm font-semibold', connected ? 'text-success' : 'text-warning')}>
            {connected ? 'Ready' : status?.state ?? 'Unavailable'}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Server queue</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{pendingMessages}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className={cn('mt-1 text-sm font-semibold', failedMessages ? 'text-destructive' : 'text-foreground')}>
            {failedMessages}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Local outbox</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{localQueue.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <Smartphone className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Device link</p>
            {status?.lastError && (
              <span className="ml-auto max-w-[50%] truncate text-[10px] text-destructive" title={status.lastError}>
                {status.lastError}
              </span>
            )}
          </div>
          <div className="p-4">
            {connected ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto size-7 text-success" />
                <p className="mt-2 text-xs font-medium text-foreground">WhatsApp is connected</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Incoming messages are persisted before triage. No patient message is lost.
                </p>
              </div>
            ) : qr ? (
              <div className="text-center">
                <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                  <img src={qr} alt="WhatsApp linking QR code" className="size-48" />
                </div>
                <p className="mt-3 text-xs font-medium text-foreground">Scan to link the Toju device</p>
                <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                  Open WhatsApp → Linked devices → Link a device. The QR refreshes automatically every 15
                  seconds.
                </p>
              </div>
            ) : (
              <div className="py-8 text-center">
                <QrCode className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-2 text-xs font-medium text-foreground">No QR code available</p>
                <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                  {online
                    ? 'The bridge is starting. Refresh in a moment to link this device.'
                    : 'Connect to the internet to view the device linking code.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <MessageCircle className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Queue a manual message</p>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <label htmlFor="wa-phone" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Phone number
              </label>
              <input
                id="wa-phone"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+234 801 234 5678"
                className="h-9 w-full rounded-full border bg-background px-3 text-xs outline-none focus:border-primary/40"
              />
              {patients.length > 0 && (
                <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
                  {patients.slice(0, 8).map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => prefill(patient.phoneNumber)}
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {patient.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="wa-body" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Message
              </label>
              <textarea
                id="wa-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                placeholder="Write a message to the patient…"
                className="w-full resize-none rounded-xl border bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary/40"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {online ? 'Queued locally, then handed to the server outbox.' : 'Will send when you reconnect.'}
              </p>
              <Button
                size="sm"
                onClick={() => void queueMessage()}
                loading={sending}
                disabled={!phoneNumber.trim() || !body.trim()}
                startIcon={!sending ? <Send className="size-3.5" /> : undefined}
              >
                Queue
              </Button>
            </div>
            {pendingClinical > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {pendingClinical} clinical change{pendingClinical === 1 ? '' : 's'} also waiting to sync.
              </p>
            )}
          </div>
        </section>
      </div>

      {localQueue.length > 0 && (
        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <CloudOff className="size-4 text-warning" />
            <p className="text-sm font-medium text-muted-foreground">Local outbox</p>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={!online || syncing}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary disabled:opacity-40"
            >
              <RefreshCw className={cn('size-3', syncing && 'animate-spin')} />
              Sync now
            </button>
          </div>
          <div className="divide-y">
            {localQueue.map((op) => {
              const payload = op.payload as { phoneNumber?: string; body?: string }
              return (
                <div key={op.id} className="flex items-start gap-3 px-4 py-3">
                  <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {payload.phoneNumber ?? 'Unknown number'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {payload.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {op.status} · attempt {op.attempts} · {timeAgo(op.createdAt)}
                      {op.lastError ? ` · ${op.lastError}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border">
        <div className="flex items-center gap-2 border-b p-4">
          <Send className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Server outbox</p>
          <span className="ml-auto text-[10px] text-muted-foreground">{messages.length} recent</span>
        </div>

        {messages.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-muted-foreground">
              {online
                ? 'No outbound messages yet. Approving a care signal queues a welcome message.'
                : 'Connect to the internet to inspect the server outbox.'}
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <div className="divide-y">
            {messages.map((message) => {
              const tone = messageTone[message.status]
              return (
                <div key={message.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', tone.cls)}>
                        {tone.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{message.kind}</span>
                      <span className="text-[10px] text-muted-foreground">{message.phoneNumber}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-foreground">{message.body}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {message.sentAt ? `Sent ${formatDateTime(message.sentAt)}` : formatDateTime(message.createdAt)}
                      {message.attempts > 0 ? ` · ${message.attempts} attempt${message.attempts === 1 ? '' : 's'}` : ''}
                      {message.lastError ? ` · ${message.lastError}` : ''}
                    </p>
                  </div>
                  {message.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void retry(message.id)}
                      disabled={retrying === message.id}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {retrying === message.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Retry
                    </button>
                  )}
                  {message.status === 'sent' && <CheckCircle2 className="mt-1 size-4 shrink-0 text-success" />}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-xl border bg-secondary/30 px-3 py-2.5">
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          WhatsApp does not support background delivery from a phone that is offline. The server keeps the
          durable queue, retries with exponential backoff, and persists every inbound message before triage.
        </p>
      </div>
    </div>
  )
}
