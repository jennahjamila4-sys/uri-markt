'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { submitCommentAction, deleteCommentAction } from '@/app/actions/transactions'
import { hasCensoredContent } from '@/lib/censor'
import { useAppStore } from '@/store/appStore'

const MAX = 1000

interface CommentRow {
  id: string
  user_id: string | null
  content: string
  created_at: string | null
  profiles: { username: string | null; avatar_url: string | null } | null
}

interface Props {
  listingId: string
}

// Schweizer Datumsformat dd.MM.yyyy, HH:mm (CLAUDE.md Lokalisierung).
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Supabase liefert die 1:1-Relation je nach Query als Objekt ODER Array —
// defensiv flatten (wie in Block 2).
function flattenProfile(p: unknown): CommentRow['profiles'] {
  if (!p) return null
  const obj = Array.isArray(p) ? p[0] : p
  if (!obj) return null
  const o = obj as { username?: string | null; avatar_url?: string | null }
  return { username: o.username ?? null, avatar_url: o.avatar_url ?? null }
}

export function CommentSection({ listingId }: Props) {
  const supabase = createClient()
  const user = useAppStore((s) => s.user)
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen)

  const [comments, setComments] = useState<CommentRow[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Re-Entry-Guard gegen Doppelklick: der disabled-Button greift erst nach dem
  // Re-Render, dieser Ref sofort.
  const submittingRef = useRef(false)

  const loadComments = useCallback(async () => {
    // Explizite Spaltenliste, kein SELECT *. Join nur mit benoetigten Feldern.
    const { data, error: qErr } = await supabase
      .from('comments')
      .select('id,user_id,content,created_at,profiles!comments_user_id_fkey(username,avatar_url)')
      .eq('listing_id', listingId)
      // Sortierung: neueste zuerst. Begruendung: das Eingabefeld steht UEBER der
      // Liste, ein frisch gesendeter Kommentar erscheint so sofort ganz oben ohne
      // Scrollen. Einheitlich absteigend.
      .order('created_at', { ascending: false })
      .limit(100)

    if (qErr) {
      setError(`Kommentare konnten nicht geladen werden: ${qErr.message}`)
      return
    }
    setError(null)
    const rows = (data ?? []).map((r) => {
      const rr = r as unknown as {
        id: string
        user_id: string | null
        content: string
        created_at: string | null
        profiles: unknown
      }
      return {
        id: rr.id,
        user_id: rr.user_id,
        content: rr.content,
        created_at: rr.created_at,
        profiles: flattenProfile(rr.profiles),
      }
    })
    setComments(rows)
  }, [supabase, listingId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const trimmedLen = input.trim().length
  const tooLong = trimmedLen > MAX
  const isEmpty = trimmedLen === 0
  const willCensor = hasCensoredContent(input)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    setError(null)
    if (isEmpty) {
      setError('Kommentar darf nicht leer sein')
      return
    }
    if (tooLong) {
      setError(`Kommentar darf max. ${MAX} Zeichen lang sein`)
      return
    }
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      await submitCommentAction({ listing_id: listingId, text: input })
      setInput('')
      toast.success('Kommentar veroeffentlicht')
      await loadComments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kommentar fehlgeschlagen'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await deleteCommentAction(id)
      setConfirmId(null)
      toast.success('Kommentar geloescht')
      await loadComments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Loeschen fehlgeschlagen'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4" data-testid="comment-section">
      <h3 className="font-display text-lg font-bold text-white">
        Kommentare (<span data-testid="comment-count">{comments.length}</span>)
      </h3>

      {/* Eingabe nur fuer eingeloggte Nutzer; sonst sichtbarer Hinweis + Login-Link. */}
      {user ? (
        <div>
          <textarea
            data-testid="comment-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Schreib einen Kommentar…"
            className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
          />
          <div className="mt-1 flex items-center justify-between">
            <span
              data-testid="comment-char-count"
              className={`text-xs ${tooLong ? 'text-uri-fomo' : 'text-white/40'}`}
            >
              {trimmedLen}/{MAX}
            </span>
            {willCensor && (
              <span className="text-xs text-uri-fomo">
                Kontaktdaten/Links werden automatisch entfernt.
              </span>
            )}
          </div>
          {error && (
            <p data-testid="comment-error" className="mt-1 text-sm text-uri-fomo">
              {error}
            </p>
          )}
          <button
            data-testid="comment-submit"
            onClick={handleSubmit}
            // Nur waehrend des Requests sperren (Doppelklick-Schutz). Leer/zu-lang
            // NICHT hier sperren, sonst gaebe es keine sichtbare Fehlermeldung (Spec).
            disabled={isSubmitting}
            className="btn-gold mt-2 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Wird gesendet…' : 'Senden'}
          </button>
        </div>
      ) : (
        <div data-testid="comment-login-hint" className="text-sm text-white/60">
          <span>Melde dich an, um zu kommentieren. </span>
          <button
            data-testid="comment-login-btn"
            onClick={() => setAuthModalOpen(true)}
            className="font-semibold text-gold hover:underline"
          >
            Anmelden
          </button>
        </div>
      )}

      {/* Ladefehler auch ohne Login sichtbar (kein stummes Nichts, Lektion 7). */}
      {!user && error && (
        <p data-testid="comment-error" className="text-sm text-uri-fomo">
          {error}
        </p>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {comments.map((c) => {
          const deleted = !c.user_id || !c.profiles
          const authorName = deleted ? 'Geloeschter Nutzer' : (c.profiles?.username ?? 'Geloeschter Nutzer')
          const isOwn = !!user && !!c.user_id && c.user_id === user.id
          return (
            <div key={c.id} className="flex gap-3" data-testid="comment-item">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-obsidian-4">
                {!deleted && c.profiles?.avatar_url && (
                  <Image src={c.profiles.avatar_url} alt={authorName} fill className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white" data-testid="comment-author">
                    {authorName}
                  </p>
                  <span className="text-xs text-white/40">{formatDate(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-white/70">
                  {c.content}
                </p>

                {/* Loeschen nur fuer eigene Kommentare; Bestaetigung zweistufig.
                    KEIN Bearbeiten-Button: die DB hat kein UPDATE-Recht (Lektion 6). */}
                {isOwn && (
                  <div className="mt-1">
                    {confirmId === c.id ? (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-white/60">Wirklich loeschen?</span>
                        <button
                          data-testid="comment-delete-confirm-btn"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="font-semibold text-uri-fomo hover:underline disabled:opacity-50"
                        >
                          {deletingId === c.id ? 'Wird geloescht…' : 'Ja, loeschen'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={deletingId === c.id}
                          className="text-white/50 hover:underline"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        data-testid="comment-delete-btn"
                        onClick={() => {
                          setError(null)
                          setConfirmId(c.id)
                        }}
                        className="text-xs text-white/40 hover:text-uri-fomo hover:underline"
                      >
                        Loeschen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {comments.length === 0 && (
          <p data-testid="comment-empty" className="text-sm text-white/40">
            Noch keine Kommentare. Sei der Erste!
          </p>
        )}
      </div>
    </div>
  )
}
