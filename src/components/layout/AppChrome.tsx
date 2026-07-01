'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useXPWatcher } from '@/hooks/useXPWatcher'
import { useNotifications } from '@/hooks/useNotifications'
import { useAppStore } from '@/store/appStore'
import { LevelUpModal } from '@/components/gamification/LevelUpModal'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { ListingDetail } from '@/components/listing/ListingDetail'
import { CreateModal } from '@/components/create/CreateModal'
import { AuthModal } from '@/components/auth/AuthModal'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

/**
 * App-weites Chrome: globale Hooks (Auth, XP-Watcher, Realtime-Notifications)
 * und Overlays (Level-Up, Notification-Panel, Listing-Detail).
 * Wird einmal im Root-Layout gemountet.
 */
export function AppChrome() {
  const { user } = useAuth()
  useXPWatcher()
  useNotifications(user?.id)

  const selectedListingId = useAppStore((s) => s.selectedListingId)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen)

  // Server-Redirect `/?auth=required` (z.B. Profil ohne Login) → Auth-Modal öffnen
  // und den Parameter aus der URL entfernen, damit es nicht erneut auslöst.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'required') {
      setAuthModalOpen(true)
      params.delete('auth')
      const qs = params.toString()
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : '')
      )
    }
  }, [setAuthModalOpen])

  return (
    <>
      <LevelUpModal />
      <NotificationPanel />
      <CreateModal />
      <AuthModal />
      <OnboardingFlow />
      {selectedListingId && (
        <ListingDetail
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </>
  )
}
