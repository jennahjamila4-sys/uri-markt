'use client'

import type { AiField } from '@/lib/analyzeListing'
import type { SmartData, SmartValue } from './SmartFields'

/**
 * BLOCK 14 — Generische Render-Engine für die von der KI gelieferten `felder[]`.
 * Kennt KEINE Kategorie-Logik: rendert je nach `typ` ein Chip-Band, ein
 * Zahlen-Band, einen Toggle oder ein Textfeld. Antworten landen in smart_data
 * unter dem (bereits normalisierten) KI-`key`. Nur befüllte Keys bleiben.
 */

interface AiFieldsProps {
  fields: AiField[]
  value: SmartData
  onChange: (next: SmartData) => void
}

function setKey(data: SmartData, key: string, v: SmartValue | undefined): SmartData {
  const next = { ...data }
  if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
    delete next[key]
  } else {
    next[key] = v
  }
  return next
}

/** Zählt befüllte KI-Felder (für die Match-Power-Anzeige). */
export function aiFilledCount(fields: AiField[], value: SmartData): number {
  let filled = 0
  for (const f of fields) {
    const v = value[f.key]
    if (v == null) continue
    if (Array.isArray(v) ? v.length > 0 : String(v) !== '') filled++
  }
  return filled
}

function scaleValues(min: number, max: number, step: number): number[] {
  const out: number[] = []
  for (let n = min; n <= max + 1e-9; n += step) {
    out.push(Math.round(n * 100) / 100)
  }
  return out
}

export function AiFields({ fields, value, onChange }: AiFieldsProps) {
  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.key} data-testid={`ai-field-${f.key}`} className="animate-fade-in">
          <label className="text-sm font-display font-bold text-white">{f.label}</label>
          <div className="mt-2">
            {f.typ === 'chips' && (
              <div className="flex flex-wrap gap-2">
                {(f.optionen ?? []).map((opt) => {
                  const arr = Array.isArray(value[f.key]) ? (value[f.key] as string[]) : []
                  const active = arr.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const nextArr = active ? arr.filter((x) => x !== opt) : [...arr, opt]
                        onChange(setKey(value, f.key, nextArr))
                      }}
                      className={`chip-pop rounded-full px-3 py-1.5 text-sm transition ${
                        active
                          ? 'bg-gold text-obsidian font-bold'
                          : 'glass-card glass-card-hover text-white/80'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {f.typ === 'zahlen_skala' &&
              f.min != null &&
              f.max != null &&
              f.schritt != null && (
                <div
                  data-testid={`ai-scale-${f.key}`}
                  className="flex gap-2 overflow-x-auto pb-2"
                >
                  {scaleValues(f.min, f.max, f.schritt).map((n) => {
                    const active = value[f.key] === String(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          onChange(setKey(value, f.key, active ? undefined : String(n)))
                        }
                        className={`chip-pop min-w-[3rem] shrink-0 rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-gold text-obsidian font-bold'
                            : 'glass-card glass-card-hover text-white/80'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              )}

            {f.typ === 'toggle' && (
              <div className="flex gap-2">
                {['Ja', 'Nein'].map((opt) => {
                  const active = value[f.key] === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(setKey(value, f.key, active ? undefined : opt))}
                      className={`chip-pop rounded-full px-4 py-1.5 text-sm transition ${
                        active
                          ? 'bg-gold text-obsidian font-bold'
                          : 'glass-card glass-card-hover text-white/80'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {f.typ === 'text' && (
              <input
                type="text"
                value={(value[f.key] as string) ?? ''}
                onChange={(e) => onChange(setKey(value, f.key, e.target.value))}
                className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
