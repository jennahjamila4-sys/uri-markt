'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { OnboardingScreen1, type Persona } from './screens/OnboardingScreen1'
import { OnboardingScreen2 } from './screens/OnboardingScreen2'

/**
 * Onboarding — 2 Screens (Block 12). Screen 1: Hook + zwei Persona-Karten.
 * Screen 2: Smart-Match-Story (Herzstück) + Geschenk + persona-abhängige
 * Gratulation + CTA „Los geht's" → Registrierung. Keine Benachrichtigungs-/
 * Interessen-Screens mehr (Benachrichtigungen liegen jetzt in den Profil-
 * Einstellungen). Kein Fake-Social-Proof, keine erfundenen Zahlen.
 */
export function OnboardingFlow() {
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted)
  const setOnboardingCompleted = useAppStore((s) => s.setOnboardingCompleted)
  const openAuthModal = useAppStore((s) => s.openAuthModal)

  const [currentScreen, setCurrentScreen] = useState<1 | 2>(1)
  const [persona, setPersona] = useState<Persona>(null)
  const [mounted, setMounted] = useState(false)

  // Persistierten Store erst nach Mount auswerten (kein SSR/Hydration-Mismatch).
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  if (onboardingCompleted) return null

  const handleSelect = (p: Persona) => {
    setPersona(p)
    setCurrentScreen(2)
  }

  const handleComplete = () => {
    setOnboardingCompleted(true)
    // „Los geht's" → direkt in die Registrierung.
    openAuthModal('register')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-hidden rounded-[28px] border border-glass-border shadow-modal">
        {currentScreen === 1 ? (
          <OnboardingScreen1 onSelect={handleSelect} />
        ) : (
          <OnboardingScreen2
            persona={persona}
            onBack={() => setCurrentScreen(1)}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  )
}
