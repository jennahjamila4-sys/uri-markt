import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Profile, Notification } from '@/types'

interface AppState {
  user: Profile | null
  setUser: (u: Profile | null) => void

  notifications: Notification[]
  unreadCount: number
  addNotification: (n: Notification) => void
  markAllRead: () => void
  setNotifications: (ns: Notification[]) => void

  onboardingCompleted: boolean
  setOnboardingCompleted: (v: boolean) => void

  levelUp: { level: string; xp: number } | null
  setLevelUp: (v: { level: string; xp: number } | null) => void

  isNotificationPanelOpen: boolean
  setNotificationPanelOpen: (v: boolean) => void

  isAuthModalOpen: boolean
  setAuthModalOpen: (v: boolean) => void

  isCreateModalOpen: boolean
  setCreateModalOpen: (v: boolean) => void
  createModalTab: 'Angebot' | 'Gesuch' | 'Event'
  setCreateModalTab: (t: 'Angebot' | 'Gesuch' | 'Event') => void

  selectedListingId: string | null
  setSelectedListingId: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      notifications: [],
      unreadCount: 0,
      addNotification: (n) =>
        set((s) => ({
          notifications: [n, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        })),
      markAllRead: () => set({ unreadCount: 0 }),
      setNotifications: (ns) => set({ notifications: ns }),

      onboardingCompleted: false,
      setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),

      levelUp: null,
      setLevelUp: (v) => set({ levelUp: v }),

      isNotificationPanelOpen: false,
      setNotificationPanelOpen: (v) => set({ isNotificationPanelOpen: v }),

      isAuthModalOpen: false,
      setAuthModalOpen: (v) => set({ isAuthModalOpen: v }),

      isCreateModalOpen: false,
      setCreateModalOpen: (v) => set({ isCreateModalOpen: v }),
      createModalTab: 'Angebot',
      setCreateModalTab: (t) => set({ createModalTab: t }),

      selectedListingId: null,
      setSelectedListingId: (id) => set({ selectedListingId: id }),
    }),
    {
      name: 'uri-markt-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboardingCompleted: s.onboardingCompleted,
      }),
    }
  )
)
