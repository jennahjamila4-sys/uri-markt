'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateProfileAction } from '@/app/actions/profile'
import { GEMEINDEN, CATEGORIES } from '@/types'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
}

export function EditProfileForm({ profile }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [gemeinde, setGemeinde] = useState(profile.gemeinde ?? '')
  const [cats, setCats] = useState<string[]>(profile.preferred_categories ?? [])
  const [saving, setSaving] = useState(false)

  const toggleCat = (id: string) =>
    setCats((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : prev.length >= 10
          ? prev
          : [...prev, id]
    )

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfileAction({
        full_name: fullName,
        gemeinde,
        preferred_categories: cats,
      })
      toast.success('Profil gespeichert! 💪')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Speichern hat nicht geklappt 😕'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-glass-border bg-obsidian-3 p-4">
        <label className="block text-sm font-semibold text-white/90">
          Vollständiger Name
        </label>
        <input
          type="text"
          data-testid="profile-edit-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="z.B. Max Müller"
          maxLength={100}
          className="w-full rounded-xl border border-glass-border bg-obsidian-4 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-glass-border bg-obsidian-3 p-4">
        <label className="block text-sm font-semibold text-white/90">Gemeinde</label>
        <select
          data-testid="profile-edit-gemeinde"
          value={gemeinde}
          onChange={(e) => setGemeinde(e.target.value)}
          className="w-full rounded-xl border border-glass-border bg-obsidian-4 px-3 py-2.5 text-white focus:border-gold/50 focus:outline-none"
        >
          <option value="">Keine Angabe</option>
          {GEMEINDEN.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 rounded-2xl border border-glass-border bg-obsidian-3 p-4">
        <label className="block text-sm font-semibold text-white/90">
          Bevorzugte Kategorien{' '}
          <span className="text-white/50">({cats.length}/10)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = cats.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCat(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? 'border-gold/60 bg-gold/15 text-gold'
                    : 'border-glass-border bg-obsidian-4 text-white/70 hover:border-white/20'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        data-testid="profile-edit-save"
        className="w-full rounded-xl bg-gold py-3 font-display font-bold text-obsidian transition hover:bg-gold-lt active:scale-95 disabled:opacity-50"
      >
        {saving ? 'Speichert…' : '✅ Profil speichern'}
      </button>
    </div>
  )
}
