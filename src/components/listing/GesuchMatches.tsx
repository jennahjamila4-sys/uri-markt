'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { dismissMatchAction } from '@/app/actions/listings'
import { useAppStore } from '@/store/appStore'

/**
 * „🎯 Deine Matches" auf dem Detail des EIGENEN Gesuchs.
 * Nur der Owner sieht diese Sektion (Render-Guard in ListingDetail,
 * zusätzlich RLS own-only auf smart_matches).
 */
interface MatchRow {
  id: string
  score: number
  listing: {
    id: string
    title: string
    price: number | null
    gemeinde: string
    image_url: string | null
  } | null
}

export function GesuchMatches({ gesuchId, userId }: { gesuchId: string; userId: string }) {
  const [matches, setMatches] = useState<MatchRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('smart_matches')
        .select(
          'id,score,listing:listings!smart_matches_matched_listing_id_fkey(id,title,price,gemeinde,image_url)'
        )
        .eq('user_id', userId)
        .eq('gesuch_id', gesuchId)
        .eq('dismissed', false)
        .order('score', { ascending: false })
        .limit(20)

      if (!mounted) return
      if (error) {
        // Fehler ≠ leeres Ergebnis (Lektion 7): sichtbar machen, nicht als „keine Matches" tarnen
        console.error('[GesuchMatches]', error.message)
        toast.error('Matches konnten nicht geladen werden')
        setMatches([])
        return
      }
      setMatches((data ?? []) as unknown as MatchRow[])
    })()
    return () => {
      mounted = false
    }
  }, [gesuchId, userId])

  const dismiss = async (id: string) => {
    setBusyId(id)
    const prev = matches
    // optimistisch entfernen, bei Fehler sichtbar zurückrollen (Lektion 6)
    setMatches((m) => (m ? m.filter((x) => x.id !== id) : m))
    try {
      await dismissMatchAction(id)
    } catch (err) {
      setMatches(prev)
      toast.error(err instanceof Error ? err.message : 'Ausblenden fehlgeschlagen')
    } finally {
      setBusyId(null)
    }
  }

  if (matches === null) return null // lädt noch

  return (
    <div className="border-t border-glass-border pt-4" data-testid="gesuch-matches">
      <h3 className="mb-3 font-display text-lg font-bold text-white">
        🎯 Deine Matches
      </h3>

      {matches.length === 0 ? (
        <p className="text-sm text-white/60">
          Noch keine Matches — wir benachrichtigen dich, sobald etwas passt.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div
              key={m.id}
              data-testid="match-card"
              className="flex items-center gap-3 rounded-2xl border border-glass-border bg-obsidian-3 p-3 backdrop-blur"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-obsidian-4">
                {m.listing?.image_url && (
                  <Image
                    src={m.listing.image_url}
                    alt={m.listing.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => m.listing && setSelectedListingId(m.listing.id)}
              >
                <p className="truncate font-semibold text-white">
                  {m.listing?.title ?? 'Inserat'}
                </p>
                <p className="text-sm text-white/60">
                  {m.listing?.gemeinde}
                  {m.listing?.price != null && (
                    <span className="text-gold"> · CHF {m.listing.price.toLocaleString('de-CH')}</span>
                  )}
                </p>
              </button>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-gold px-2.5 py-0.5 font-display text-xs font-bold text-obsidian">
                  {m.score}% Match
                </span>
                <button
                  disabled={busyId === m.id}
                  onClick={() => dismiss(m.id)}
                  className="rounded-lg border border-glass-border px-2.5 py-0.5 text-xs text-white/60 disabled:opacity-50"
                >
                  Ausblenden
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
