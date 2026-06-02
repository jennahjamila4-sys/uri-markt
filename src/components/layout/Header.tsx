'use client'
import Link from 'next/link'
import { Bell, User } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/hooks/useAuth'

export function Header() {
  const { user } = useAuth()
  const unreadCount = useAppStore((s) => s.unreadCount)
  const setCreateModalOpen = useAppStore((s) => s.setCreateModalOpen)

  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-obsidian/80 backdrop-blur-heavy">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1 font-display text-xl font-bold">
          Uri-Markt
          <span className="text-gold">●</span>
        </Link>
        <div className="flex items-center gap-4">
          <button className="relative">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-obsidian">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCreateModalOpen(!useAppStore.getState().isCreateModalOpen)}
            className="text-white/60"
          >
            {user ? <User size={20} /> : 'Login'}
          </button>
        </div>
      </div>
    </header>
  )
}
