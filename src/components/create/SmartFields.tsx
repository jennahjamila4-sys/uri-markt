'use client'

import type { SmartField } from '@/lib/gesuchConfig'

/**
 * BLOCK 10 — Stufe 2 „Match-Booster": kategorie-spezifische Felder als
 * antippbare Chips/Pills (nie leere Textfelder wo vermeidbar). Der Wert fliesst
 * in listings.smart_data und real in den Match-Score — deshalb ist die
 * Match-Power-Anzeige ehrlich.
 *
 * Werte: Pills → string[] (Mehrfachauswahl), alles andere → string. Leere Werte
 * werden vom Formular entfernt (keine leeren Keys in smart_data).
 */

export type SmartValue = string | string[]
export type SmartData = Record<string, SmartValue>

interface SmartFieldsProps {
  fields: SmartField[]
  value: SmartData
  onChange: (next: SmartData) => void
}

function setKey(data: SmartData, id: string, v: SmartValue | undefined): SmartData {
  const next = { ...data }
  if (
    v === undefined ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  ) {
    delete next[id]
  } else {
    next[id] = v
  }
  return next
}

export function matchPower(fields: SmartField[], value: SmartData): {
  filled: number
  total: number
  label: string
} {
  const ids = new Set(fields.map((f) => f.id))
  // „verhandelbar" zählt als Bonus-Signal mit.
  const total = fields.length + 1
  let filled = 0
  for (const key of Object.keys(value)) {
    const v = value[key]
    const has = Array.isArray(v) ? v.length > 0 : v !== ''
    if (has && (ids.has(key) || key === 'verhandelbar')) filled++
  }
  let label = 'Noch keine Extra-Infos'
  const ratio = filled / total
  if (filled === 0) label = 'Noch keine Extra-Infos'
  else if (ratio < 0.34) label = 'Solide — schon besser auffindbar'
  else if (ratio < 0.67) label = 'Stark — Käufer finden dich schneller'
  else label = 'Volle Match-Power ✨'
  return { filled, total, label }
}

export function SmartFields({ fields, value, onChange }: SmartFieldsProps) {
  const { filled, total, label } = matchPower(fields, value)
  const verhandelbar = value['verhandelbar'] === 'Ja'

  return (
    <div className="space-y-4">
      {/* Ehrliche Match-Power-Anzeige */}
      <div className="rounded-lg border border-glass-border bg-obsidian-4 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-bold text-white/80">Match-Power</span>
          <span className="text-xs text-gold">{label}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < filled ? 'bg-gold' : 'bg-glass'}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-white/50">
          So finden dich Käufer schneller — je mehr passt, desto besser der Match.
        </p>
      </div>

      {fields.map((f) => (
        <div key={f.id}>
          <label className="text-sm font-display font-bold text-white">{f.label}</label>
          <div className="mt-2">
            {f.type === 'pills' && (
              <div className="flex flex-wrap gap-2">
                {(f.options ?? []).map((opt) => {
                  const arr = Array.isArray(value[f.id]) ? (value[f.id] as string[]) : []
                  const active = arr.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const nextArr = active
                          ? arr.filter((x) => x !== opt)
                          : [...arr, opt]
                        onChange(setKey(value, f.id, nextArr))
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
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

            {f.type === 'toggle' && (
              <div className="flex flex-wrap gap-2">
                {(f.options ?? []).map((opt) => {
                  const active = value[f.id] === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(setKey(value, f.id, active ? undefined : opt))}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
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

            {f.type === 'select' && (
              <select
                value={(value[f.id] as string) ?? ''}
                onChange={(e) => onChange(setKey(value, f.id, e.target.value))}
                className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="">– auswählen –</option>
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {f.type === 'slider' && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={f.min ?? 0}
                  max={f.max ?? 100}
                  step={f.step ?? 1}
                  value={(value[f.id] as string) || String(f.defaultVal ?? f.min ?? 0)}
                  onChange={(e) => onChange(setKey(value, f.id, e.target.value))}
                  className="flex-1"
                />
                <span className="min-w-[80px] text-right text-sm font-bold text-gold">
                  {(value[f.id] as string) || String(f.defaultVal ?? f.min ?? 0)} {f.unit ?? ''}
                </span>
              </div>
            )}

            {f.type === 'date' && (
              <input
                type="date"
                value={(value[f.id] as string) ?? ''}
                onChange={(e) => onChange(setKey(value, f.id, e.target.value))}
                className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
              />
            )}

            {(f.type === 'text' || f.type === 'number') && (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder ?? ''}
                value={(value[f.id] as string) ?? ''}
                onChange={(e) => onChange(setKey(value, f.id, e.target.value))}
                className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
              />
            )}
          </div>
        </div>
      ))}

      {/* „Verhandelbar" immer verfügbar */}
      <button
        type="button"
        onClick={() =>
          onChange(setKey(value, 'verhandelbar', verhandelbar ? undefined : 'Ja'))
        }
        className={`rounded-full px-3 py-1.5 text-sm transition ${
          verhandelbar
            ? 'bg-gold text-obsidian font-bold'
            : 'glass-card glass-card-hover text-white/80'
        }`}
      >
        {verhandelbar ? '✓ Verhandelbar' : 'Verhandelbar'}
      </button>
    </div>
  )
}
