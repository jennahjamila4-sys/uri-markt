'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES } from '@/types'

interface FomoListing {
  id: string
  title: string
  price: number | null
  image_url: string | null
  category: string
  fomo_expires_at: string | null
}

/** Kategorie-Id → Emoji (für den entsättigten FOMO-Look der Referenz) */
const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.emoji])
)

/**
 * „Kürzlich verpasst" – verkaufte Inserate, die noch 24h sichtbar bleiben
 * (fomo_expires_at > now). Optik nach docs/design/design-referenz.html:
 * entsättigte Karten mit schrägem, pulsierendem „VERKAUFT"-Stempel.
 * Reine Optik – die Auswahl-Logik (fomo_expires_at) bleibt unverändert.
 */
export function FomoZone() {
  const supabase = createClient()
  const [items, setItems] = useState<FomoListing[]>([])
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('listings')
        .select('id, title, price, image_url, category, fomo_expires_at')
        .eq('status', 'sold')
        .gt('fomo_expires_at', new Date().toISOString())
        .order('fomo_expires_at', { ascending: false })
        .limit(10)
      if (mounted && data) setItems(data)
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  if (items.length === 0) return null

  return (
    <section
      className="reveal"
      style={{ animationDelay: '0.22s' }}
    >
      <div className="mx-4 mb-3 mt-5 flex items-center justify-between">
        <h3 className="flex items-center gap-[7px] font-display text-[15px] font-bold">
          <span className="animate-flick text-uri-fire">⚡</span>
          <span className="text-uri-danger">Kürzlich verpasst</span>
        </h3>
        <span className="text-xl text-white/35">›</span>
      </div>

      <div className="flex snap-x snap-mandatory gap-[11px] overflow-x-auto px-4 pb-1 scrollbar-hide">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedListingId(item.id)}
            className="relative w-[158px] shrink-0 snap-start rounded-2xl border border-glass-border bg-gradient-to-br from-[#161616] to-[#0d0d0d] p-3.5 text-left saturate-[.55]"
          >
            <div className="text-3xl brightness-90 grayscale-[.3]">
              {CATEGORY_EMOJI[item.category] ?? '📦'}
            </div>
            <div className="mt-2 line-clamp-2 text-[13px] font-semibold leading-tight text-white/[0.78]">
              {item.title}
            </div>
            <div className="mt-[3px] text-[13px] font-bold text-white/55">
              CHF {(item.price ?? 0).toFixed(2)}
            </div>
            <div className="animate-stamp mt-2.5 inline-block -rotate-3 rounded-[7px] border-[1.4px] border-uri-danger px-2 py-1 font-display text-[9.5px] font-bold tracking-wide text-uri-danger">
              VERKAUFT
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
