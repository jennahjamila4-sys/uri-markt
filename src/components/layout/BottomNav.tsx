'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, User } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export function BottomNav() {
  const pathname = usePathname()
  const setCreateModalOpen = useAppStore((s) => s.setCreateModalOpen)

  const isActive = (path: string) => pathname === path

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-glass-border bg-obsidian/90 pb-safe backdrop-blur-heavy">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 text-xs font-body transition ${
            isActive('/') ? 'text-gold' : 'text-white/60'
          }`}
        >
          <Home size={24} />
          <span>Markt</span>
        </Link>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="relative -translate-y-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/80 shadow-gold transition hover:shadow-lg active:scale-95"
        >
          <Plus size={28} className="text-obsidian" />
        </button>

        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 text-xs font-body transition ${
            isActive('/profile') ? 'text-gold' : 'text-white/60'
          }`}
        >
          <User size={24} />
          <span>Profil</span>
        </Link>
      </div>
    </nav>
  )
}
