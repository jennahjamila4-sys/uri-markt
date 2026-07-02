'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  onNext: () => void
}

export function OnboardingScreen4({ onNext }: Props) {
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Benachrichtigungen werden von diesem Browser nicht unterstützt')
      return
    }

    // Nicht-sicherer Kontext (z. B. Zugriff über http://<LAN-IP> statt localhost/https):
    // requestPermission() verweigert dort sofort OHNE Prompt – das sähe wie ein Bug aus.
    if (!window.isSecureContext) {
      toast.error('Bitte über https oder localhost öffnen, um Benachrichtigungen zu aktivieren')
      return
    }

    // Bereits im Browser blockiert – ein erneuter Request zeigt keinen Prompt mehr.
    if (Notification.permission === 'denied') {
      toast.error('Im Browser blockiert – bitte in den Seiteneinstellungen erlauben')
      return
    }

    setIsRequestingPermission(true)
    try {
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        toast.success('Benachrichtigungen aktiviert!')
        setTimeout(() => onNext(), 1000)
      } else if (permission === 'denied') {
        toast.error('Benachrichtigungen abgelehnt')
      }
      // 'default' = Prompt weggeklickt: keine Fehlermeldung, Nutzer kann erneut oder „Später"
    } catch (err) {
      console.error(err)
      toast.error('Fehler beim Aktivieren')
    } finally {
      setIsRequestingPermission(false)
    }
  }

  return (
    <div className="h-[90vh] flex flex-col justify-between p-8 bg-gradient-to-b from-obsidian-2 to-obsidian-3 overflow-y-auto">
      <div className="pt-16" />

      <div className="text-center space-y-6">
        <div className="text-6xl">🔔</div>

        <h2 className="text-3xl font-display font-bold text-white">
          Bleib am Ball
        </h2>

        <p className="text-white/70 max-w-sm mx-auto">
          Wir benachrichtigen dich nur bei echten Matches und wichtigen Updates. Keine Spam-Nachrichten.
        </p>

        <div className="bg-gold/10 border border-gold/50 rounded-lg p-4">
          <p className="text-white/80">
            📲 Erhalte sofort Bescheid, wenn du neue Deals findest oder jemand dein Inserat anfragte.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={requestNotificationPermission}
          disabled={isRequestingPermission}
          className="w-full py-3 bg-gradient-to-r from-gold to-amber-600 text-obsidian font-bold rounded-lg hover:shadow-lg hover:shadow-gold/50 transition-all disabled:opacity-50"
        >
          {isRequestingPermission ? 'Wird aktiviert...' : '✓ Benachrichtigungen aktivieren'}
        </button>

        <button
          onClick={onNext}
          className="w-full py-3 bg-obsidian-2 border border-glass-border text-white font-bold rounded-lg hover:border-white/20 transition-all"
        >
          Später
        </button>
      </div>

      <div className="pb-4" />
    </div>
  )
}
