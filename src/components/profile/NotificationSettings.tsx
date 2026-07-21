'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Perm = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * Benachrichtigungs-Einstellungen (aus dem Onboarding hierher verschoben,
 * Block 12). Fragt die Browser-Benachrichtigungs-Berechtigung an. Feature
 * unverändert erreichbar, nur der Ort ist neu. Zeigt jeden Zustand klar an
 * (Lektion 6): nicht unterstützt / blockiert / aktiv / anfragbar.
 */
export function NotificationSettings() {
  const [perm, setPerm] = useState<Perm>('default')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPerm('unsupported')
      return
    }
    setPerm(Notification.permission as Perm)
  }, [])

  const request = async () => {
    if (!('Notification' in window)) {
      setPerm('unsupported')
      return
    }
    // Nicht-sicherer Kontext (http über LAN-IP): requestPermission() verweigert
    // sofort ohne Prompt – das sähe wie ein Bug aus.
    if (!window.isSecureContext) {
      toast.error('Bitte über https oder localhost öffnen, um Benachrichtigungen zu aktivieren')
      return
    }
    if (Notification.permission === 'denied') {
      toast.error('Im Browser blockiert – bitte in den Seiteneinstellungen erlauben')
      return
    }

    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPerm(result as Perm)
      if (result === 'granted') toast.success('Benachrichtigungen aktiviert!')
      else if (result === 'denied') toast.error('Benachrichtigungen abgelehnt')
      // 'default' = Prompt weggeklickt: kein Fehler, erneut möglich.
    } catch (err) {
      console.error('[NotificationSettings]', err)
      toast.error('Fehler beim Aktivieren')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-glass-border bg-obsidian-3 p-4" data-testid="notification-settings">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="min-w-0">
          <p className="font-display font-bold text-white">Benachrichtigungen</p>
          <p className="mt-0.5 text-sm text-white/60">
            Wir melden uns nur bei echten Smart Matches und wichtigen Updates. Kein Spam.
          </p>
        </div>
      </div>

      {perm === 'granted' ? (
        <p className="rounded-xl border border-uri-success/40 bg-uri-success/10 px-3 py-2 text-sm text-uri-success">
          ✓ Benachrichtigungen sind aktiviert.
        </p>
      ) : perm === 'unsupported' ? (
        <p className="rounded-xl border border-glass-border bg-obsidian-4 px-3 py-2 text-sm text-white/50">
          Dieser Browser unterstützt keine Benachrichtigungen.
        </p>
      ) : perm === 'denied' ? (
        <p className="rounded-xl border border-uri-danger/30 bg-uri-danger/10 px-3 py-2 text-sm text-white/70">
          Im Browser blockiert – bitte in den Seiteneinstellungen wieder erlauben.
        </p>
      ) : (
        <button
          onClick={request}
          disabled={busy}
          data-testid="notification-enable-btn"
          className="w-full rounded-xl bg-gold py-2.5 font-display font-bold text-obsidian transition hover:bg-gold-lt disabled:opacity-50"
        >
          {busy ? 'Wird aktiviert…' : '✓ Benachrichtigungen aktivieren'}
        </button>
      )}
    </div>
  )
}
