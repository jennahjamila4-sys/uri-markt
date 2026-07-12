'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { deleteAccountAction } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'

const CONFIRM_WORD = 'LÖSCHEN'

/**
 * Danger-Zone: Konto endgültig löschen. Zweistufig (öffnen → Wort tippen →
 * bestätigen), damit kein Fehlklick das Konto entfernt. Blockiert die Server-
 * Action wegen offener Deals, wird der Grund sichtbar gezeigt (Lektion 6) und
 * das Konto bleibt bestehen. Bei Erfolg: lokale Session beenden + Startseite.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)

  const canDelete =
    confirm.trim().toUpperCase() === CONFIRM_WORD && !pending

  const handleDelete = async () => {
    setPending(true)
    setBlocked(null)
    try {
      const res = await deleteAccountAction()
      if (!res.success) {
        setBlocked(res.error)
        toast.error(res.error)
        setPending(false)
        return
      }
      await createClient().auth.signOut()
      toast.success('Dein Konto wurde gelöscht. Machs guet! 👋')
      window.location.href = '/'
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Löschen fehlgeschlagen 😕'
      )
      setPending(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-uri-danger/40 bg-uri-danger/5 p-4">
      <div>
        <p className="font-display font-bold text-uri-danger">
          ⚠️ Konto löschen
        </p>
        <p className="mt-1 text-sm text-white/70">
          Das entfernt dein Profil, deine Zahlungsangaben und deine Inserate
          endgültig. Abgeschlossene Deals und Bewertungen bleiben anonymisiert
          („Gelöschter Nutzer“) bestehen. Das kann nicht rückgängig gemacht
          werden.
        </p>
      </div>

      {!open ? (
        <button
          type="button"
          data-testid="account-delete-open"
          onClick={() => {
            setOpen(true)
            setBlocked(null)
          }}
          className="rounded-xl border border-uri-danger/60 px-4 py-2.5 text-sm font-semibold text-uri-danger transition hover:bg-uri-danger/10"
        >
          Konto löschen …
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-white/80">
            Tippe <b className="text-uri-danger">{CONFIRM_WORD}</b>, um die
            Löschung zu bestätigen:
          </label>
          <input
            type="text"
            data-testid="account-delete-confirm-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="w-full rounded-xl border border-glass-border bg-obsidian-4 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-uri-danger focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="account-delete-confirm-btn"
              onClick={handleDelete}
              disabled={!canDelete}
              className="rounded-xl bg-uri-danger px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {pending ? 'Löscht…' : 'Endgültig löschen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setConfirm('')
                setBlocked(null)
              }}
              disabled={pending}
              className="rounded-xl border border-glass-border px-4 py-2.5 text-sm text-white/70 transition hover:text-white disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {blocked && (
        <p
          data-testid="account-delete-blocked-reason"
          className="rounded-xl border border-uri-danger/40 bg-uri-danger/10 px-3 py-2 text-sm text-uri-danger"
        >
          {blocked}
        </p>
      )}
    </div>
  )
}
