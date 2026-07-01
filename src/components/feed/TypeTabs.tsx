'use client'
import { useEffect, useRef, useState } from 'react'
import type { ListingType } from '@/types'

const TABS: { type: ListingType; label: string; emoji: string }[] = [
  { type: 'Angebot', label: 'Angebote', emoji: '🏷️' },
  { type: 'Gesuch', label: 'Gesuche', emoji: '🔍' },
  { type: 'Event', label: 'Vorankündigungen', emoji: '🚀' },
]

interface Props {
  value: ListingType
  onChange: (type: ListingType) => void
}

/**
 * Typ-Tabs nach docs/design/design-referenz.html: drei Tabs mit einer
 * Gold-Pille, die animiert unter den aktiven Tab gleitet. Die Pillen-Position
 * wird per Messung des aktiven Buttons gesetzt (robust gegen Textbreiten).
 * Der Wert steuert echte Daten-Filterung im FeedPage – keine reine Deko.
 */
export function TypeTabs({ value, onChange }: Props) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 })

  useEffect(() => {
    const measure = () => {
      const idx = TABS.findIndex((t) => t.type === value)
      const el = tabRefs.current[idx]
      if (el) {
        setPill({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value])

  return (
    <div
      className="reveal relative mx-3.5 mb-1.5 mt-[18px] flex gap-1 rounded-2xl border border-glass-border bg-glass p-[5px]"
      style={{ animationDelay: '0.16s' }}
    >
      {/* Gleitende Gold-Pille */}
      <div
        aria-hidden
        className="absolute z-[1] rounded-[11px] bg-gradient-to-br from-gold-lt to-gold shadow-[0_4px_14px_rgba(255,215,0,0.3)] transition-[left,top,width,height] duration-300 ease-smooth"
        style={{
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          opacity: pill.width ? 1 : 0,
        }}
      />

      {TABS.map((tab, i) => {
        const active = tab.type === value
        return (
          <button
            key={tab.type}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            onClick={() => onChange(tab.type)}
            className={`relative z-[2] flex flex-1 items-center justify-center gap-1.5 rounded-[11px] px-1 py-[11px] text-[13px] transition-colors duration-200 ${
              active
                ? 'font-display font-bold text-black'
                : 'font-semibold text-white/55'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
