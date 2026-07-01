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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-glass-border bg-[#070708]/85 pb-safe backdrop-blur-heavy">
      <div className="mx-auto flex h-[84px] max-w-[480px] items-start justify-around px-4 pt-3">
        <Link
          href="/"
          className={`flex w-16 flex-col items-center gap-[5px] text-[10.5px] font-semibold transition ${
            isActive('/') ? 'text-gold' : 'text-white/55'
          }`}
        >
          <Home
            size={23}
            className={`stroke-[1.8] ${isActive('/') ? 'fill-gold/[0.18]' : ''}`}
          />
          Marktplatz
        </Link>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="-mt-[26px] flex flex-col items-center"
          aria-label="Inserat erstellen"
        >
          <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-gradient-to-br from-gold-lt to-gold-deep shadow-[0_8px_26px_rgba(255,152,0,0.5),0_0_0_6px_rgba(0,0,0,0.4)] transition active:scale-[0.93]">
            <Plus size={28} className="stroke-[2.6] text-black" />
          </span>
          <span className="mt-[7px] text-[10.5px] font-semibold text-white/55">
            Erstellen
          </span>
        </button>

        <Link
          href="/profile"
          className={`flex w-16 flex-col items-center gap-[5px] text-[10.5px] font-semibold transition ${
            isActive('/profile') ? 'text-gold' : 'text-white/55'
          }`}
        >
          <User
            size={23}
            className={`stroke-[1.8] ${isActive('/profile') ? 'fill-gold/[0.18]' : ''}`}
          />
          Profil
        </Link>
      </div>
    </nav>
  )
}
