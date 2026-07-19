'use client'

import { useEffect, useState } from 'react'

/**
 * Minuten-Tick für Live-Countdowns. Gibt `null` bis zum Mount zurück und danach
 * `Date.now()`, aktualisiert 1×/Minute. Das `null`-bis-Mount-Verhalten ist
 * bewusst: Server und Client rendern beim ersten Paint denselben (statischen)
 * Zustand → kein Hydration-Mismatch (Lektion 19). Erst nach dem Mount startet
 * die zeitabhängige Anzeige.
 */
export function useMinuteTick(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/**
 * Text für ein reserviertes Inserat aus `reserved_until` (öffentlich lesbar).
 * - `now == null` (vor Mount) oder kein `reserved_until` → generisches
 *   „⏳ Reserviert" (stabil, hydration-sicher).
 * - abgelaufen, aber Status noch 'reserved' (Cron-Lag ≤ 5 Min) → ehrlich
 *   „🔄 Gleich wieder frei…" — NIE den Status raten.
 * - < 90 Min Restzeit → Minuten, sonst Stunden.
 */
export function reservedRemainingText(
  reservedUntil: string | null | undefined,
  now: number | null
): string {
  if (now == null || !reservedUntil) return '⏳ Reserviert'
  const diff = new Date(reservedUntil).getTime() - now
  if (diff <= 0) return '🔄 Gleich wieder frei…'
  const mins = Math.round(diff / 60000)
  if (mins < 90) return `⏳ Reserviert — noch ${Math.max(1, mins)} Min.`
  const hours = Math.round(mins / 60)
  return `⏳ Reserviert — noch ${hours} Std.`
}

/**
 * „🔄 Wieder erhältlich": Inserat ist `active` UND `relisted_at` liegt in den
 * letzten 48 h. Die Spalte wird NUR bei echter Reaktivierung gesetzt, der
 * Sticker ist also immer ehrlich.
 */
export function isRecentlyRelisted(
  relistedAt: string | null | undefined,
  now: number | null
): boolean {
  if (now == null || !relistedAt) return false
  const diff = now - new Date(relistedAt).getTime()
  return diff >= 0 && diff <= 48 * 3600 * 1000
}

/**
 * Kompakter Deal-Countdown-Text (Käufer/Verkäufer) aus `reserved_until`.
 * Einzige Wahrheit ist `reserved_until` — kein Nachrechnen aus confirmed_at.
 * `null`, solange keine Frist vorliegt oder vor Mount.
 */
export function dealRemainingText(
  reservedUntil: string | null | undefined,
  now: number | null
): string | null {
  if (now == null || !reservedUntil) return null
  const diff = new Date(reservedUntil).getTime() - now
  if (diff <= 0) return 'gleich abgelaufen'
  const mins = Math.round(diff / 60000)
  if (mins < 90) return `noch ${Math.max(1, mins)} Min.`
  const hours = Math.round(mins / 60)
  return `noch ${hours} Std.`
}
