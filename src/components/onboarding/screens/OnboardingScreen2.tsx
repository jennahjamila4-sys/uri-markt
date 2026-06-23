'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { toast } from 'sonner'
import { GEMEINDEN } from '@/types'

interface Props {
  onNext: () => void
}

export function OnboardingScreen2({ onNext }: Props) {
  const supabase = createClient()
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [gemeinde, setGemeinde] = useState(user?.gemeinde ?? '')
  const [isLoading, setIsLoading] = useState(false)

  const handleNext = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          gemeinde: gemeinde || null,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setUser(data)
      onNext()
    } catch (err) {
      toast.error('Fehler beim Speichern')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-[90vh] flex flex-col justify-between p-8 bg-gradient-to-b from-obsidian-2 to-obsidian-3 overflow-y-auto">
      <div className="pt-12" />

      <div className="space-y-6">
        <h2 className="text-3xl font-display font-bold text-white">Profil vervollständigen</h2>

        <div className="space-y-3">
          <label className="block text-white/70 text-sm">Vollständiger Name (optional)</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="z.B. Max Müller"
            className="w-full px-4 py-3 bg-obsidian-3 border border-glass-border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-white/70 text-sm">Gemeinde</label>
          <select
            value={gemeinde}
            onChange={(e) => setGemeinde(e.target.value)}
            className="w-full px-4 py-3 bg-obsidian-3 border border-glass-border rounded-lg text-white focus:outline-none focus:border-gold"
          >
            <option value="">Wähle deine Gemeinde...</option>
            {GEMEINDEN.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-gold to-amber-600 text-obsidian font-bold rounded-lg hover:shadow-lg hover:shadow-gold/50 transition-all disabled:opacity-50"
      >
        {isLoading ? 'Speichern...' : 'Weiter'}
      </button>

      <div className="pb-4" />
    </div>
  )
}
