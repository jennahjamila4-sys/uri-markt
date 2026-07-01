'use client'

import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { X } from 'lucide-react'

/** Icon je nach Notification-Type */
const TYPE_ICON: Record<string, string> = {
  tx_pending: '⚡',
  tx_confirmed: '✅',
  tx_completed: '🏆',
  tx_rejected: '❌',
  no_show: '⚠️',
  smart_match: '🎯',
  default: '🔔',
}

interface NotificationPayload {
  title?: string
  message?: string
  listing_id?: string
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${Math.round(hours / 24)} Tagen`
}

export function NotificationPanel() {
  const isOpen = useAppStore((s) => s.isNotificationPanelOpen)
  const setOpen = useAppStore((s) => s.setNotificationPanelOpen)
  const notifications = useAppStore((s) => s.notifications)
  const markAllRead = useAppStore((s) => s.markAllRead)
  const user = useAppStore((s) => s.user)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  const handleMarkAll = async () => {
    markAllRead()
    if (user) {
      const supabase = createClient()
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    }
  }

  const handleClick = (listingId?: string) => {
    if (listingId) {
      setSelectedListingId(listingId)
      setOpen(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-[100dvh] w-[85vw] max-w-sm transform border-l border-glass-border bg-obsidian-2 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-glass-border p-4">
          <h2 className="font-display text-lg font-bold text-white">
            Benachrichtigungen
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAll}
              className="text-xs text-gold hover:underline"
            >
              Alle als gelesen
            </button>
            <button onClick={() => setOpen(false)} className="text-white/60">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="h-[calc(100dvh-60px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="text-4xl">🔔</div>
              <p className="text-white/60">Keine neuen Benachrichtigungen</p>
            </div>
          ) : (
            notifications.map((n) => {
              const payload = (n.payload ?? {}) as NotificationPayload
              const icon = TYPE_ICON[n.type ?? 'default'] ?? TYPE_ICON.default
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(payload.listing_id)}
                  className="flex w-full items-start gap-3 border-b border-glass-border/50 p-4 text-left transition hover:bg-white/5"
                >
                  <span className="text-xl">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {payload.title ?? 'Benachrichtigung'}
                    </p>
                    {payload.message && (
                      <p className="mt-0.5 text-sm text-white/60">
                        {payload.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-white/40">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
