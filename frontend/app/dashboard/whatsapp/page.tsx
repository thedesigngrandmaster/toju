'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'

type Status = 'loading' | 'ready' | 'awaiting-qr' | 'qr-ready' | 'error'

export default function WhatsAppPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const poll = useCallback(async () => {
    try {
      const data = await api.whatsapp.qr()
      setLastChecked(new Date())
      if (data.ready) {
        setStatus('ready')
        setQr(null)
      } else if (data.qr) {
        setStatus('qr-ready')
        setQr(data.qr)
      } else {
        setStatus('awaiting-qr')
      }
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [poll])

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground font-display">
          WhatsApp Bot
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect the bot to start sending check-ins to patients
        </p>
      </div>

      {/* Status card */}
      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          {status === 'ready' ? (
            <CheckCircle className="size-5 text-green-500 shrink-0" />
          ) : status === 'error' ? (
            <WifiOff className="size-5 text-destructive shrink-0" />
          ) : (
            <Wifi className="size-5 text-muted-foreground shrink-0 animate-pulse" />
          )}
          <div>
            <p className="text-xs font-medium text-foreground">
              {status === 'ready' && 'Bot is connected'}
              {status === 'awaiting-qr' && 'Waiting for QR code…'}
              {status === 'qr-ready' && 'Scan the QR code below'}
              {status === 'loading' && 'Checking connection…'}
              {status === 'error' && 'Cannot reach backend'}
            </p>
            {lastChecked && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Last checked {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={poll}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        {status === 'qr-ready' && qr && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="bg-white p-3 rounded-lg border">
              <img src={qr} alt="WhatsApp QR Code" width={220} height={220} />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
            </p>
          </div>
        )}

        {status === 'ready' && (
          <div className="text-[11px] text-muted-foreground">
            The bot will receive patient replies and send daily check-in messages at 7:00 AM.
          </div>
        )}

        {status === 'awaiting-qr' && (
          <div className="text-[11px] text-muted-foreground">
            The server is starting up the WhatsApp client. The QR code will appear here in a few seconds.
          </div>
        )}

        {status === 'error' && (
          <div className="text-[11px] text-destructive">
            Could not reach the backend. Check that the server is running.
          </div>
        )}
      </div>

      {status !== 'ready' && (
        <div className="border rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">How to connect</p>
          <ol className="space-y-1.5 text-[11px] text-muted-foreground list-decimal list-inside">
            <li>Wait for the QR code to appear above</li>
            <li>Open WhatsApp on the bot phone (08026709004)</li>
            <li>Go to Settings → Linked Devices → Link a Device</li>
            <li>Scan the QR code — the page will update automatically</li>
          </ol>
        </div>
      )}
    </div>
  )
}
