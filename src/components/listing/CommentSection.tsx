'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { submitCommentAction } from '@/app/actions/transactions'
import { censorText } from '@/lib/censor'
import { useAppStore } from '@/store/appStore'

interface CommentRow {
  id: string
  censored_text: string | null
  text: string
  created_at: string | null
  profiles: {
    username: string
    avatar_url: string | null
  } | null
}

interface Props {
  listingId: string
}

export function CommentSection({ listingId }: Props) {
  const supabase = createClient()
  const user = useAppStore((s) => s.user)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select(
        'id,censored_text,text,created_at,profiles!comments_user_id_fkey(username,avatar_url)'
      )
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setComments(data as unknown as CommentRow[])
  }

  useEffect(() => {
    loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  const handleSubmit = async () => {
    if (!input.trim()) return
    setIsSubmitting(true)
    try {
      await submitCommentAction({ listing_id: listingId, text: input })
      setInput('')
      toast.success('Kommentar veröffentlicht')
      await loadComments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kommentar fehlgeschlagen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Live-Vorschau der Zensur (UX) – serverseitig wird erneut zensiert (Sicherheit)
  const willCensor = input !== censorText(input)

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-bold text-white">
        Kommentare ({comments.length})
      </h3>

      {/* Eingabe */}
      {user ? (
        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Schreib einen Kommentar…"
            className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
          />
          {willCensor && (
            <p className="mt-1 text-xs text-uri-fomo">
              ⚠️ Kontaktdaten/Links werden automatisch entfernt.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !input.trim()}
            className="btn-gold mt-2 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Wird gesendet…' : 'Senden'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/50">
          Melde dich an, um zu kommentieren.
        </p>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-obsidian-4">
              {c.profiles?.avatar_url && (
                <Image
                  src={c.profiles.avatar_url}
                  alt={c.profiles.username ?? ''}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {c.profiles?.username ?? 'Nutzer'}
              </p>
              <p className="text-sm text-white/70">
                {c.censored_text ?? c.text}
              </p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-white/40">
            Noch keine Kommentare. Sei der Erste!
          </p>
        )}
      </div>
    </div>
  )
}
