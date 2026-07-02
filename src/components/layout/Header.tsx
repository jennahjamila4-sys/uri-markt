'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Bell } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/hooks/useAuth'
import { ProfileMenu } from './ProfileMenu'

export function Header() {
  const { user } = useAuth()
  const unreadCount = useAppStore((s) => s.unreadCount)
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen)
  const setNotificationPanelOpen = useAppStore((s) => s.setNotificationPanelOpen)

  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b border-glass-border bg-[#070708]/70 px-4 backdrop-blur-heavy">
      {/* Marke: Gold-Stier-Logo + URI-MARKT / Kanton Uri */}
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/uri-markt-uristier-logo.png"
          alt="Uri-Markt Uristier"
          width={38}
          height={38}
          priority
          className="drop-shadow-[0_2px_8px_rgba(255,215,0,0.35)]"
        />
        <div className="leading-none">
          <h1 className="font-display text-[19px] font-extrabold tracking-wide">
            URI<b className="text-gold">-</b>MARKT
          </h1>
          <p className="mt-0.5 text-[10.5px] uppercase tracking-[1.5px] text-white/55">
            Kanton Uri
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        {/* Bell: Glas-Kachel, Beacon-Puls bei ungelesenen Benachrichtigungen */}
        <button
          onClick={() => setNotificationPanelOpen(true)}
          aria-label="Benachrichtigungen"
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-glass-border bg-glass transition active:scale-90"
        >
          <Bell size={19} className="stroke-[1.8]" />
          {unreadCount > 0 && (
            <span className="animate-beacon absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-obsidian">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Rechte Aktion: angemeldet → Profil-Menü (Dropdown), sonst „Anmelden". */}
        {user ? (
          <ProfileMenu />
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="rounded-xl border border-gold/45 bg-gradient-to-br from-gold/[0.14] to-gold-deep/[0.06] px-[18px] py-[9px] font-display text-[13.5px] font-bold text-gold transition hover:border-gold hover:shadow-gold active:scale-95"
          >
            Anmelden
          </button>
        )}
      </div>
    </header>
  )
}
