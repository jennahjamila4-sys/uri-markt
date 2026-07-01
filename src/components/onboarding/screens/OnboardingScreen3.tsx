'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES } from '@/types'
import { toast } from 'sonner'

interface Props {
  onNext: () => void
}

export function OnboardingScreen3({ onNext }: Props) {
  const supabase = createClient()
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  const [selectedCategories, setSelectedCategories] = useState<string[]>(user?.preferred_categories ?? [])
  const [isLoading, setIsLoading] = useState(false)

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId].slice(0, 10) // Max 10
    )
  }

  const handleNext = async () => {
    // Ohne Login keine Persistenz der Präferenzen → weiter ohne Speichern.
    if (!user) {
      onNext()
      return
    }
    if (selectedCategories.length === 0) {
      toast.error('Wähle mindestens eine Kategorie')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ preferred_categories: selectedCategories })
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
      <div className="pt-6" />

      <div className="space-y-4">
        <h2 className="text-3xl font-display font-bold text-white">Was interessiert dich?</h2>
        <p className="text-white/60">Wähle deine Lieblingskateg orien (max. 10)</p>

        {/* Category Grid */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedCategories.includes(cat.id)
                  ? 'border-gold bg-gold/10'
                  : 'border-glass-border bg-obsidian-3 hover:border-gold/50'
              }`}
            >
              <div className="text-2xl mb-1">{cat.emoji}</div>
              <div className="text-sm font-medium text-white">{cat.label}</div>
            </button>
          ))}
        </div>

        <div className="text-white/50 text-xs text-center mt-4">
          {selectedCategories.length}/10 gewählt
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={isLoading || (!!user && selectedCategories.length === 0)}
        className="w-full py-3 bg-gradient-to-r from-gold to-amber-600 text-obsidian font-bold rounded-lg hover:shadow-lg hover:shadow-gold/50 transition-all disabled:opacity-50"
      >
        {isLoading ? 'Speichern...' : 'Weiter'}
      </button>

      <div className="pb-4" />
    </div>
  )
}
