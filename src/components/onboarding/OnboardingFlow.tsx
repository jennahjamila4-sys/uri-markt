'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { createClient } from '@/lib/supabase/client'
import { OnboardingScreen1 } from './screens/OnboardingScreen1'
import { OnboardingScreen2 } from './screens/OnboardingScreen2'
import { OnboardingScreen3 } from './screens/OnboardingScreen3'
import { OnboardingScreen4 } from './screens/OnboardingScreen4'
import { OnboardingScreen5 } from './screens/OnboardingScreen5'

export function OnboardingFlow() {
  const supabase = createClient()
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted)
  const setOnboardingCompleted = useAppStore((s) => s.setOnboardingCompleted)

  const [currentScreen, setCurrentScreen] = useState(1)
  const [pioneerCount, setPioneerCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Persistierten Store erst nach Mount auswerten (kein SSR/Hydration-Mismatch)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Load pioneer count
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('pioneer_badge', true)
      .then(({ count }) => {
        setPioneerCount(count ?? 0)
      })
  }, [supabase])

  // Vor dem Mount nichts rendern (Server & Client identisch → kein Mismatch)
  if (!mounted) return null
  // Don't show if onboarding already completed
  if (onboardingCompleted) return null

  const screens = [
    <OnboardingScreen1 key={1} pioneerCount={Math.max(0, 50 - pioneerCount)} onNext={() => setCurrentScreen(2)} />,
    <OnboardingScreen2 key={2} onNext={() => setCurrentScreen(3)} />,
    <OnboardingScreen3 key={3} onNext={() => setCurrentScreen(4)} />,
    <OnboardingScreen4 key={4} onNext={() => setCurrentScreen(5)} />,
    <OnboardingScreen5 key={5} onComplete={() => setOnboardingCompleted(true)} />,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Dots Progress */}
        <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-10">
          {[1, 2, 3, 4, 5].map((dot) => (
            <div
              key={dot}
              className={`h-2 w-2 rounded-full transition-all ${
                dot === currentScreen ? 'bg-gold w-6' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        {screens[currentScreen - 1]}
      </div>
    </div>
  )
}
